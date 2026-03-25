import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KokoroTTS } from "kokoro-js";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const VOICE = "af_heart";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, "../../public/audio/af_heart");

const clips = [
  ["training-room", "Training room."],
  ["test-started", "Test started."],
  ["correct", "Correct!"],
  ["different", "Different."],
  ["skipped", "Skipped."],
  ["say-it-again", "Say it again."],
  ["say-one-choice-only", "Say one choice only."],
  ["test-finished-press-space-to-go-to-results", "Test finished. Press space to go to results."],

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
];

async function main() {
  await mkdir(outDir, { recursive: true });

  console.log(`Loading Kokoro model ${MODEL_ID}...`);
  const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: "q8",
    device: "cpu",
  });

  console.log(`Writing ${clips.length} clips to ${outDir}`);
  for (const [slug, text] of clips) {
    console.log(`Generating ${slug}.wav`);
    const audio = await tts.generate(text, { voice: VOICE });
    await audio.save(path.join(outDir, `${slug}.wav`));
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
