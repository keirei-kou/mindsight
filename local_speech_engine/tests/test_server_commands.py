from __future__ import annotations

import unittest

from local_speech_engine.protocol import normalize_command


class ServerCommandTests(unittest.TestCase):
    def test_vad_command_aliases_normalize_to_canonical_names(self) -> None:
        self.assertEqual(normalize_command("start_vad"), "start_vad")
        self.assertEqual(normalize_command("start_listening"), "start_vad")
        self.assertEqual(normalize_command("stop_vad"), "stop_vad")
        self.assertEqual(normalize_command("stop_listening"), "stop_vad")

    def test_asr_commands_are_unchanged(self) -> None:
        self.assertEqual(normalize_command("list_asr_providers"), "list_asr_providers")
        self.assertEqual(normalize_command("load_asr_provider"), "load_asr_provider")
        self.assertEqual(normalize_command("transcribe_latest_segment"), "transcribe_latest_segment")
        self.assertEqual(normalize_command("transcribe_segment"), "transcribe_segment")
        self.assertEqual(normalize_command("arbitrate_segment"), "arbitrate_segment")
        self.assertEqual(normalize_command("arbitrate_latest_segment"), "arbitrate_latest_segment")

    def test_voice_note_command_aliases_normalize_to_canonical_names(self) -> None:
        self.assertEqual(normalize_command("start_voice_note"), "start_voice_note")
        self.assertEqual(normalize_command("start_voice_note_recording"), "start_voice_note")
        self.assertEqual(normalize_command("stop_voice_note"), "stop_voice_note")
        self.assertEqual(normalize_command("stop_voice_note_recording"), "stop_voice_note")

    def test_recording_delete_aliases_normalize_to_canonical_name(self) -> None:
        self.assertEqual(normalize_command("delete_recording_segment"), "delete_recording_segment")
        self.assertEqual(normalize_command("delete_segment"), "delete_recording_segment")
        self.assertEqual(normalize_command("delete_recording"), "delete_recording_segment")


if __name__ == "__main__":
    unittest.main()
