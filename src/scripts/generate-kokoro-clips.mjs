import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KokoroTTS } from "kokoro-js";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const VOICE = process.env.KOKORO_VOICE || "af_heart";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = process.env.KOKORO_OUTDIR
  ? path.resolve(__dirname, process.env.KOKORO_OUTDIR)
  : path.resolve(__dirname, `../../public/audio/${VOICE}`);

const clips = [
  ["training-room", "Training room."],
  ["calibration", "Calibration."],
  ["calibration-instructions", "Press \"A\" or \"D\" to cycle through options. Submission is paused."],
  ["test-mode", "Test Mode."],
  ["test-mode-instructions", "Press \"A\" or \"D\" to cycle through options, and press \"space\" to submit the response."],
  ["test-started", "Test started."],
  ["test-resumed", "Test resumed."],
  ["correct", "Correct!"],
  ["different", "Different."],
  ["skipped", "Skipped."],
  ["say-it-again", "Say it again."],
  ["say-one-choice-only", "Say one choice only."],
  ["test-finished-press-space-to-go-to-results", "Test finished. Press space to go to results."],
  ["test-finished-press-space-or-say-results-to-go-to-the-results-page", "Test finished. Press space or say results to go to the results page."],
  ["results-go-to-results", "Results. Go to results."],
  ["results", "Results."],

  ["first-card", "First card."],
  ["second-card", "Second card."],
  ["third-card", "Third card."],
  ["fourth-card", "Fourth card."],
  ["fifth-card", "Fifth card."],
  ["sixth-card", "Sixth card."],
  ["seventh-card", "Seventh card."],
  ["eighth-card", "Eighth card."],
  ["ninth-card", "Ninth card."],
  ["tenth-card", "Tenth card."],
  ["eleventh-card", "Eleventh card."],
  ["twelfth-card", "Twelfth card."],
  ["thirteenth-card", "Thirteenth card."],
  ["fourteenth-card", "Fourteenth card."],
  ["fifteenth-card", "Fifteenth card."],
  ["sixteenth-card", "Sixteenth card."],
  ["seventeenth-card", "Seventeenth card."],
  ["eighteenth-card", "Eighteenth card."],
  ["nineteenth-card", "Nineteenth card."],
  ["twentieth-card", "Twentieth card."],
  ["twenty-first-card", "Twenty first card."],
  ["twenty-second-card", "Twenty second card."],
  ["twenty-third-card", "Twenty third card."],
  ["twenty-fourth-card", "Twenty fourth card."],
  ["twenty-fifth-card", "Twenty fifth card."],
  ["twenty-sixth-card", "Twenty sixth card."],
  ["twenty-seventh-card", "Twenty seventh card."],
  ["twenty-eighth-card", "Twenty eighth card."],
  ["twenty-ninth-card", "Twenty ninth card."],
  ["thirtieth-card", "Thirtieth card."],
  ["thirty-first-card", "Thirty first card."],
  ["thirty-second-card", "Thirty second card."],
  ["thirty-third-card", "Thirty third card."],
  ["thirty-fourth-card", "Thirty fourth card."],
  ["thirty-fifth-card", "Thirty fifth card."],
  ["thirty-sixth-card", "Thirty sixth card."],

  ["red", "Red"],
  ["orange", "Orange"],
  ["yellow", "Yellow"],
  ["green", "Green"],
  ["blue", "Blue"],
  ["purple", "Purple"],

  ["one", "One"],
  ["two", "Two"],
  ["three", "Three"],
  ["four", "Four"],
  ["five", "Five"],
  ["six", "Six"],

  ["circle", "Circle"],
  ["oval", "Oval"],
  ["square", "Square"],
  ["rectangle", "Rectangle"],
  ["triangle", "Triangle"],
  ["diamond", "Diamond"],
  ["star", "Star"],
  ["wavy", "Wavy"],
  ["cross", "Cross"],
  ["did-you-say-red", "Did you say Red?"],
  ["did-you-say-orange", "Did you say Orange?"],
  ["did-you-say-yellow", "Did you say Yellow?"],
  ["did-you-say-green", "Did you say Green?"],
  ["did-you-say-blue", "Did you say Blue?"],
  ["did-you-say-purple", "Did you say Purple?"],
  ["did-you-say-one", "Did you say One?"],
  ["did-you-say-two", "Did you say Two?"],
  ["did-you-say-three", "Did you say Three?"],
  ["did-you-say-four", "Did you say Four?"],
  ["did-you-say-five", "Did you say Five?"],
  ["did-you-say-six", "Did you say Six?"],
  ["did-you-say-circle", "Did you say Circle?"],
  ["did-you-say-oval", "Did you say Oval?"],
  ["did-you-say-square", "Did you say Square?"],
  ["did-you-say-rectangle", "Did you say Rectangle?"],
  ["did-you-say-triangle", "Did you say Triangle?"],
  ["did-you-say-diamond", "Did you say Diamond?"],
  ["did-you-say-star", "Did you say Star?"],
  ["did-you-say-wavy", "Did you say Wavy?"],
  ["did-you-say-cross", "Did you say Cross?"],
  ["different-the-answer-was-red", "Different. The answer was Red."],
  ["different-the-answer-was-orange", "Different. The answer was Orange."],
  ["different-the-answer-was-yellow", "Different. The answer was Yellow."],
  ["different-the-answer-was-green", "Different. The answer was Green."],
  ["different-the-answer-was-blue", "Different. The answer was Blue."],
  ["different-the-answer-was-purple", "Different. The answer was Purple."],
  ["different-the-answer-was-one", "Different. The answer was One."],
  ["different-the-answer-was-two", "Different. The answer was Two."],
  ["different-the-answer-was-three", "Different. The answer was Three."],
  ["different-the-answer-was-four", "Different. The answer was Four."],
  ["different-the-answer-was-five", "Different. The answer was Five."],
  ["different-the-answer-was-six", "Different. The answer was Six."],
  ["different-the-answer-was-circle", "Different. The answer was Circle."],
  ["different-the-answer-was-oval", "Different. The answer was Oval."],
  ["different-the-answer-was-square", "Different. The answer was Square."],
  ["different-the-answer-was-rectangle", "Different. The answer was Rectangle."],
  ["different-the-answer-was-triangle", "Different. The answer was Triangle."],
  ["different-the-answer-was-diamond", "Different. The answer was Diamond."],
  ["different-the-answer-was-star", "Different. The answer was Star."],
  ["different-the-answer-was-wavy", "Different. The answer was Wavy."],
  ["different-the-answer-was-cross", "Different. The answer was Cross."],
];

function getClipSubfolder(slug) {
  if (slug.startsWith("different-the-answer-was-")) return "confirmations";
  if (slug.startsWith("did-you-say-") || slug.startsWith("say-")) return "confirmations";
  if (slug.endsWith("-card")) return "cards";
  if ([
    "training-room",
    "calibration",
    "calibration-instructions",
    "test-mode",
    "test-mode-instructions",
    "test-started",
    "test-resumed",
    "correct",
    "different",
    "skipped",
    "test-finished-press-space-to-go-to-results",
    "test-finished-press-space-or-say-results-to-go-to-the-results-page",
    "results-go-to-results",
    "results",
  ].includes(slug)) return "prompts";
  return "items";
}

function getPackSlugs(pack) {
  const normalized = String(pack || "").trim().toLowerCase();
  if (!normalized || normalized === "full" || normalized === "all") {
    return clips.map(([slug]) => slug);
  }

  if (normalized === "hotline") {
    return clips
      .map(([slug]) => slug)
      .filter((slug) => slug === "training-room" || getClipSubfolder(slug) === "items");
  }

  if (["items", "prompts", "cards", "confirmations"].includes(normalized)) {
    return clips
      .map(([slug]) => slug)
      .filter((slug) => getClipSubfolder(slug) === normalized);
  }

  throw new Error(`Unknown pack "${pack}". Use: hotline, items, prompts, cards, confirmations, full`);
}

const argv = process.argv.slice(2);
let pack = process.env.KOKORO_PACK || "";
let showHelp = false;
const slugsFromArgs = [];
for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg === "--help" || arg === "-h") {
    showHelp = true;
    continue;
  }
  if (arg === "--pack") {
    pack = argv[index + 1] || "";
    index += 1;
    continue;
  }
  if (arg.startsWith("--pack=")) {
    pack = arg.slice("--pack=".length);
    continue;
  }
  slugsFromArgs.push(arg);
}

const requestedSlugs = slugsFromArgs.length > 0 ? new Set(slugsFromArgs) : (
  pack ? new Set(getPackSlugs(pack)) : null
);

async function main() {
  if (showHelp) {
    console.log([
      "Usage:",
      "  node src/scripts/generate-kokoro-clips.mjs [--pack <name>] [slug ...]",
      "",
      "Packs:",
      "  hotline        training-room + all option items (fast)",
      "  items          option items only",
      "  prompts        prompt clips only",
      "  cards          card-ordinal clips only",
      "  confirmations  confirmation clips only",
      "  full           everything (slow)",
      "",
      "Env:",
      "  KOKORO_VOICE=<voice_id>",
      "  KOKORO_OUTDIR=<output_directory>",
      "  KOKORO_PACK=<pack_name>",
    ].join("\n"));
    return;
  }

  await mkdir(outDir, { recursive: true });

  const selectedClips = requestedSlugs
    ? clips.filter(([slug]) => requestedSlugs.has(slug))
    : clips;

  if (requestedSlugs && selectedClips.length !== requestedSlugs.size) {
    const foundSlugs = new Set(selectedClips.map(([slug]) => slug));
    const missingSlugs = [...requestedSlugs].filter((slug) => !foundSlugs.has(slug));
    throw new Error(`Unknown clip slug(s): ${missingSlugs.join(", ")}`);
  }

  console.log(`Loading Kokoro model ${MODEL_ID}...`);
  const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: "q8",
    device: "cpu",
  });

  if (requestedSlugs && slugsFromArgs.length === 0) {
    console.log(`Pack: ${pack}`);
  }
  console.log(`Writing ${selectedClips.length} clips to ${outDir}`);
  for (const [slug, text] of selectedClips) {
    console.log(`Generating ${slug}.wav`);
    const audio = await tts.generate(text, { voice: VOICE });
    const subfolder = getClipSubfolder(slug);
    const targetDir = path.join(outDir, subfolder);
    await mkdir(targetDir, { recursive: true });
    await audio.save(path.join(targetDir, `${slug}.wav`));
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
