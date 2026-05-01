from __future__ import annotations

import unittest

from local_speech_engine.asr_normalization import (
    VOICE_NOTE_PROFILE,
    normalize_asr_text,
    normalize_transcript_candidate,
)


class AsrNormalizationTests(unittest.TestCase):
    def test_normalizes_case_punctuation_and_whitespace(self) -> None:
        self.assertEqual(normalize_asr_text("  Red,  "), "red")
        self.assertEqual(normalize_asr_text("BLUE!!!"), "blue")
        self.assertEqual(normalize_asr_text("one    two"), "one two")

    def test_command_aliases(self) -> None:
        self.assertEqual(normalize_asr_text("read"), "red")
        self.assertEqual(normalize_asr_text("redd."), "red")
        self.assertEqual(normalize_asr_text("bread"), "red")
        self.assertEqual(normalize_asr_text("blew"), "blue")
        self.assertEqual(normalize_asr_text("to"), "two")
        self.assertEqual(normalize_asr_text("too"), "two")
        self.assertEqual(normalize_asr_text("won"), "one")

    def test_command_profile_maps_to_vocabulary_candidate(self) -> None:
        candidate = normalize_transcript_candidate("gren", vocabulary=["red", "green"])

        self.assertEqual(candidate.command, "green")
        self.assertEqual(candidate.normalized_text, "green")
        self.assertGreater(candidate.similarity, 0.7)

    def test_voice_note_profile_preserves_fuller_text(self) -> None:
        self.assertEqual(
            normalize_asr_text("  Red,  bread. ", profile=VOICE_NOTE_PROFILE),
            "Red, bread.",
        )
        candidate = normalize_transcript_candidate(
            "  Red,  bread. ",
            profile=VOICE_NOTE_PROFILE,
            vocabulary=["red"],
        )

        self.assertEqual(candidate.normalized_text, "Red, bread.")
        self.assertIsNone(candidate.command)
        self.assertEqual(candidate.similarity, 1.0)


if __name__ == "__main__":
    unittest.main()
