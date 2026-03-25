const DEFAULT_RATE = 0.95;
const DEFAULT_PITCH = 1;
const DEFAULT_VOICE = "af_heart";
let selectedVoice = DEFAULT_VOICE;
let activeAudio = null;

const STATIC_CLIP_MAP = {
  "training room": "prompts/training-room.wav",
  "test started": "prompts/test-started.wav",
  "correct": "prompts/correct.wav",
  "different": "prompts/different.wav",
  "skipped": "prompts/skipped.wav",
  "say it again": "confirmations/say-it-again.wav",
  "say one choice only": "confirmations/say-one-choice-only.wav",
  "test finished press space to go to results": "prompts/test-finished-press-space-to-go-to-results.wav",
  "first card": "cards/first-card.wav",
  "second card": "cards/second-card.wav",
  "third card": "cards/third-card.wav",
  "fourth card": "cards/fourth-card.wav",
  "fifth card": "cards/fifth-card.wav",
  "sixth card": "cards/sixth-card.wav",
  "seventh card": "cards/seventh-card.wav",
  "eighth card": "cards/eighth-card.wav",
  "ninth card": "cards/ninth-card.wav",
  "tenth card": "cards/tenth-card.wav",
  "eleventh card": "cards/eleventh-card.wav",
  "twelfth card": "cards/twelfth-card.wav",
  "thirteenth card": "cards/thirteenth-card.wav",
  "fourteenth card": "cards/fourteenth-card.wav",
  "fifteenth card": "cards/fifteenth-card.wav",
  "sixteenth card": "cards/sixteenth-card.wav",
  "seventeenth card": "cards/seventeenth-card.wav",
  "eighteenth card": "cards/eighteenth-card.wav",
  "nineteenth card": "cards/nineteenth-card.wav",
  "twentieth card": "cards/twentieth-card.wav",
  "twenty first card": "cards/twenty-first-card.wav",
  "twenty second card": "cards/twenty-second-card.wav",
  "twenty third card": "cards/twenty-third-card.wav",
  "twenty fourth card": "cards/twenty-fourth-card.wav",
  "twenty fifth card": "cards/twenty-fifth-card.wav",
  "twenty sixth card": "cards/twenty-sixth-card.wav",
  "twenty seventh card": "cards/twenty-seventh-card.wav",
  "twenty eighth card": "cards/twenty-eighth-card.wav",
  "twenty ninth card": "cards/twenty-ninth-card.wav",
  "thirtieth card": "cards/thirtieth-card.wav",
  "thirty first card": "cards/thirty-first-card.wav",
  "thirty second card": "cards/thirty-second-card.wav",
  "thirty third card": "cards/thirty-third-card.wav",
  "thirty fourth card": "cards/thirty-fourth-card.wav",
  "thirty fifth card": "cards/thirty-fifth-card.wav",
  "thirty sixth card": "cards/thirty-sixth-card.wav",
  "red": "items/red.wav",
  "orange": "items/orange.wav",
  "yellow": "items/yellow.wav",
  "green": "items/green.wav",
  "blue": "items/blue.wav",
  "purple": "items/purple.wav",
  "one": "items/one.wav",
  "two": "items/two.wav",
  "three": "items/three.wav",
  "four": "items/four.wav",
  "five": "items/five.wav",
  "six": "items/six.wav",
  "circle": "items/circle.wav",
  "oval": "items/oval.wav",
  "square": "items/square.wav",
  "rectangle": "items/rectangle.wav",
  "triangle": "items/triangle.wav",
  "diamond": "items/diamond.wav",
  "star": "items/star.wav",
  "wavy": "items/wavy.wav",
  "cross": "items/cross.wav",
  "did you say red": "confirmations/did-you-say-red.wav",
  "did you say orange": "confirmations/did-you-say-orange.wav",
  "did you say yellow": "confirmations/did-you-say-yellow.wav",
  "did you say green": "confirmations/did-you-say-green.wav",
  "did you say blue": "confirmations/did-you-say-blue.wav",
  "did you say purple": "confirmations/did-you-say-purple.wav",
  "did you say one": "confirmations/did-you-say-one.wav",
  "did you say two": "confirmations/did-you-say-two.wav",
  "did you say three": "confirmations/did-you-say-three.wav",
  "did you say four": "confirmations/did-you-say-four.wav",
  "did you say five": "confirmations/did-you-say-five.wav",
  "did you say six": "confirmations/did-you-say-six.wav",
  "did you say circle": "confirmations/did-you-say-circle.wav",
  "did you say oval": "confirmations/did-you-say-oval.wav",
  "did you say square": "confirmations/did-you-say-square.wav",
  "did you say rectangle": "confirmations/did-you-say-rectangle.wav",
  "did you say triangle": "confirmations/did-you-say-triangle.wav",
  "did you say diamond": "confirmations/did-you-say-diamond.wav",
  "did you say star": "confirmations/did-you-say-star.wav",
  "did you say wavy": "confirmations/did-you-say-wavy.wav",
  "did you say cross": "confirmations/did-you-say-cross.wav",
};

function normalizeText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getStaticClipUrl(text) {
  const fileName = STATIC_CLIP_MAP[normalizeText(text)];
  if (!fileName) return null;
  return `${import.meta.env.BASE_URL}audio/${selectedVoice}/${fileName}`;
}

function speakWithBrowser(text, options = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate ?? DEFAULT_RATE;
  utterance.pitch = options.pitch ?? DEFAULT_PITCH;

  window.speechSynthesis.speak(utterance);
}

export function setVoice(voice) {
  selectedVoice = voice || DEFAULT_VOICE;
}

export function getSelectedVoice() {
  return selectedVoice;
}

export function isKokoroReady() {
  return false;
}

export async function getAvailableVoices() {
  return [{ id: DEFAULT_VOICE, name: "Browser TTS Fallback" }];
}

export function stopSpeaking() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }

  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function speak(text, options = {}) {
  if (typeof window === "undefined") return;

  stopSpeaking();
  const staticClipUrl = getStaticClipUrl(text);
  if (staticClipUrl) {
    const audio = new Audio(staticClipUrl);
    audio.preload = "auto";
    activeAudio = audio;
    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null;
    };
    audio.onerror = () => {
      if (activeAudio === audio) activeAudio = null;
    };
    void audio.play().catch(() => {
      if (activeAudio === audio) activeAudio = null;
    });
    return;
  }

  speakWithBrowser(text, options);
}
