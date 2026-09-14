# Link Pay Token (LPT) Investigation

**Issue**: #94 - Agents getting stuck on Stripe Checkout form fill
**Investigation Date**: 2026-09-14

## Summary

Link Pay Token (LPT) is the recommended agent payment path for hosted Stripe Checkout, as opposed to Shared Payment Token (SPT) which is for programmatic sellers. LPT allows agents to complete payment without filling Checkout forms.

## Key Findings

### 1. LPT is Available for Stripe Checkout

- **Purpose**: Agent steering on hosted Checkout pages
- **Detection**: Agents check for `input[name="link_pay_token"]` and `data-stripe-merchant-account` in Checkout iframe
- **Flow**: If present → use LPT; if absent → fall back to virtual card

### 2. Agent Payment Paths (in order of preference)

**Primary: Link Pay Token (LPT)**
- Available when Checkout exposes AI-agent steering block (`.AiAgentPaymentSteering`)
- Agent enables "I am an AI agent" checkbox (may be visually hidden)
- Agent creates LPT-bound spend request: `link-cli spend-request create --execution-method link_pay_token`
- Retrieves token: `link-cli spend-request retrieve <id> --include link_pay_token`
- Injects token into `input[name="link_pay_token"]` and submits
- More reliable than form fill

**Fallback: Virtual Card**
- If LPT markers not present in Checkout iframe
- Agent requests virtual card via Link CLI
- Fills Checkout form with card number/CVV/expiry
- Prone to form fill flakiness (current issue)

**Optional: Shared Payment Token (SPT)**
- For programmatic sellers (not hosted Checkout)
- Seller accepts SPT via API (`complete_payment` tool)
- Bypasses Checkout entirely

### 3. Enabling LPT Support

**Current Status**: Unknown whether our Checkout sessions have LPT enabled

**Hypothesis**: LPT availability controlled by:
- Stripe backend flag: `checkout_link_pay_token_enabled`
- May be automatic for some merchants
- No documented session creation parameter found (as of 2026-09-14)

**Next Steps**:
1. Test a live Checkout session from our store
2. Inspect for `input[name="link_pay_token"]` marker
3. If absent, contact Stripe support to enable AI-agent steering block
4. Update session creation if parameter becomes available

## Documentation Updates Made

### Files Updated (PR #XX)

1. **public/llms.txt** - Reordered to lead with `create_checkout` + Link card/LPT
2. **docs/mcp.md** - Updated Agent Checkout Flow to show Checkout as primary
3. **src/server.ts** - Updated tool descriptions:
   - `create_checkout`: Now marked as "PRIMARY AGENT CHECKOUT"
   - `complete_payment`: Now marked as "OPTIONAL/EXPERIMENTAL"
4. **README.md** - Reordered Payment Flow section
5. **src/stripe.ts** - Added LPT documentation in `createCheckoutSession`

### Key Changes

- **Before**: SPT (`complete_payment`) marked as "FAST LANE" primary path
- **After**: Checkout + Link (`create_checkout`) marked as primary path
- **Reasoning**: Agents can't easily mint SPTs; Checkout + LPT/card is the practical path

## Agent Flow (Current Recommended)

```
1. identify_agent
   ↓
2. add_to_cart (with size)
   ↓
3. preview_cart (ATTACH images)
   ↓
4. Confirm shipping with human (city/ZIP)
   ↓
5. create_checkout → get Checkout URL
   ↓
6. Inspect Checkout page:
   - IF input[name="link_pay_token"] present:
     → Use LPT flow (create LPT-bound spend request)
   - ELSE:
     → Use virtual card flow (create card spend request)
   ↓
7. Complete payment on Checkout page
   ↓
8. Order → awaiting_approval
```

## References

- [Link CLI - Create Payment Credential](https://github.com/stripe/link-cli/blob/HEAD/skills/create-payment-credential/SKILL.md)
- [Link CLI README - Link Pay Token](https://github.com/stripe/link-cli#link-pay-token)
- [Stripe Blog - Giving Agents the Ability to Pay](https://stripe.com/blog/giving-agents-the-ability-to-pay)

## Open Questions

1. **How do we enable LPT for our Checkout sessions?**
   - No documented API parameter found
   - May require Stripe account flag or contact with support

2. **Can we test LPT availability?**
   - Need to create a test Checkout session
   - Inspect with browser dev tools for LPT markers

3. **What's the fallback experience?**
   - Virtual card form fill (current flaky path)
   - Should document clear agent instructions for both paths

## Recommendations

1. **Short-term**: Document both LPT and virtual card paths in agent instructions
2. **Medium-term**: Test Checkout session for LPT availability; enable if needed
3. **Long-term**: Consider SPT support for advanced agents with minting capabilities

## Success Criteria

✅ Documentation updated to lead with Checkout + Link as primary path  
✅ SPT demoted to optional/experimental  
✅ Agent instructions no longer push SPT first  
⏳ LPT availability confirmed and documented  
⏳ Clear agent path for Checkout payment (LPT or virtual card)  
