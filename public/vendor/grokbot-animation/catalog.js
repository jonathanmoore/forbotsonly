const defineCatalog = (entries) => Object.freeze(entries.map((entry) => Object.freeze(entry)));

export const STATE_GROUPS = defineCatalog([
  {
    id: "lifecycle",
    label: Object.freeze({ en: "Lifecycle" }),
    states: Object.freeze(["idle", "sleeping", "waking", "listening", "thinking", "searching", "working"]),
  },
  {
    id: "reactions",
    label: Object.freeze({ en: "Reactions" }),
    states: Object.freeze(["excited", "surprised", "suspicious", "angry", "drowsy", "happy", "curious", "confused", "bored", "proud", "shy", "sad", "laughing", "scared", "playful", "celebrate"]),
  },
  {
    id: "agent-morphs",
    label: Object.freeze({ en: "Agent morphs" }),
    states: Object.freeze(["orbit", "radar", "progress"]),
  },
  {
    id: "product-lifecycle",
    label: Object.freeze({ en: "Product lifecycle" }),
    states: Object.freeze(["spawning", "humming", "loading", "dictating", "writing", "sending", "receiving", "uploading", "notifying", "alerting", "dragging", "bouncing", "powering-down"]),
  },
]);

export const STATE_CATALOG = defineCatalog([
  { id: "idle", en: "Idle" },
  { id: "sleeping", en: "Sleeping" },
  { id: "waking", en: "Waking" },
  { id: "listening", en: "Listening" },
  { id: "thinking", en: "Thinking", morph: "dots" },
  { id: "searching", en: "Searching" },
  { id: "working", en: "Working" },
  { id: "excited", en: "Excited" },
  { id: "surprised", en: "Surprised" },
  { id: "suspicious", en: "Suspicious" },
  { id: "angry", en: "Angry" },
  { id: "drowsy", en: "Drowsy" },
  { id: "happy", en: "Happy" },
  { id: "curious", en: "Curious" },
  { id: "confused", en: "Confused" },
  { id: "bored", en: "Bored" },
  { id: "proud", en: "Proud" },
  { id: "shy", en: "Shy" },
  { id: "sad", en: "Sad" },
  { id: "laughing", en: "Laughing" },
  { id: "scared", en: "Scared" },
  { id: "playful", en: "Playful" },
  { id: "celebrate", en: "Celebrate" },
  { id: "orbit", en: "Orbit", morph: "orbit" },
  { id: "radar", en: "Radar", morph: "radar" },
  { id: "progress", en: "Progress", morph: "progress" },
  { id: "spawning", en: "Spawning", morph: "gather" },
  { id: "humming", en: "Humming" },
  { id: "loading", en: "Loading", morph: "whirl" },
  { id: "dictating", en: "Dictating", morph: "wave" },
  { id: "writing", en: "Writing", morph: "pencil" },
  { id: "sending", en: "Sending", morph: "send" },
  { id: "receiving", en: "Receiving", morph: "receive" },
  { id: "uploading", en: "Uploading", morph: "dock" },
  { id: "notifying", en: "Notifying" },
  { id: "alerting", en: "Alerting", morph: "bang" },
  { id: "dragging", en: "Dragging" },
  { id: "bouncing", en: "Bouncing", morph: "ball" },
  { id: "powering-down", en: "Powering down", morph: "standby" },
]);

export const SHAPE_CATALOG = defineCatalog([
  { id: "blob", en: "Blob" },
  { id: "pebble", en: "Pebble" },
  { id: "bean", en: "Bean" },
  { id: "egg", en: "Egg" },
  { id: "squircle", en: "Squircle" },
  { id: "tablet", en: "Tablet" },
  { id: "capsule", en: "Capsule" },
  { id: "cylinder", en: "Cylinder" },
  { id: "hex", en: "Hexagon" },
  { id: "gem", en: "Gem" },
  { id: "crystal", en: "Crystal" },
  { id: "wedge", en: "Wedge" },
  { id: "shield", en: "Shield" },
  { id: "dome", en: "Dome" },
  { id: "arch", en: "Arch" },
  { id: "cloud", en: "Cloud" },
  { id: "teardrop", en: "Teardrop" },
  { id: "leaf", en: "Leaf" },
]);

export const MORPH_CATALOG = defineCatalog([
  { id: "dots", en: "Thinking dots" },
  { id: "orbit", en: "Color orbit" },
  { id: "radar", en: "Radar scan" },
  { id: "progress", en: "Progress loop" },
  { id: "gather", en: "Gather" },
  { id: "wave", en: "Audio wave" },
  { id: "send", en: "Send" },
  { id: "receive", en: "Receive" },
  { id: "dock", en: "Upload dock" },
  { id: "ball", en: "Bounce ball" },
  { id: "whirl", en: "Loading whirl" },
  { id: "pencil", en: "Writing pencil" },
  { id: "bang", en: "Alert" },
  { id: "standby", en: "Standby" },
]);

const labels = (catalog, locale) => Object.freeze(Object.fromEntries(catalog.map((item) => [item.id, item[locale]])));

export const STATE_IDS = Object.freeze(STATE_CATALOG.map(({ id }) => id));
export const SHAPE_IDS = Object.freeze(SHAPE_CATALOG.map(({ id }) => id));
export const MORPH_IDS = Object.freeze(MORPH_CATALOG.map(({ id }) => id));
export const STATE_LABELS_ZH = labels(STATE_CATALOG, "zh");
export const STATE_LABELS_EN = labels(STATE_CATALOG, "en");
export const SHAPE_LABELS_ZH = labels(SHAPE_CATALOG, "zh");
export const SHAPE_LABELS_EN = labels(SHAPE_CATALOG, "en");
export const MORPH_LABELS_ZH = labels(MORPH_CATALOG, "zh");
export const MORPH_LABELS_EN = labels(MORPH_CATALOG, "en");
export const MORPH_BY_STATE = Object.freeze(Object.fromEntries(
  STATE_CATALOG.flatMap(({ id, morph }) => morph ? [[id, morph]] : []),
));
