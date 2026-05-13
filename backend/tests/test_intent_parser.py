from jarvis.core.intent_parser import IntentParser


def test_classifies_time():
    p = IntentParser()
    assert p.parse_intent("what time is it")["type"] == "time"


def test_classifies_person_identification_over_fact():
    p = IntentParser()
    assert p.parse_intent("who is this person")["type"] == "person_identification"


def test_self_referential_face_recognition_intents():
    p = IntentParser()
    for utterance in [
        "scan my face",
        "recognize me",
        "identify me",
        "use facial recognition to recognize me",
        "do you recognize me",
    ]:
        assert p.parse_intent(utterance)["type"] == "person_identification", utterance


def test_extracts_math_expression():
    p = IntentParser()
    result = p.parse_intent("calculate 15 plus 7")
    assert result["type"] == "calculation"
    assert "15" in result["expression"] and "+" in result["expression"]


def test_extracts_app_name():
    p = IntentParser()
    assert p.parse_intent("open Spotify")["app_name"].lower() == "spotify"


def test_extracts_weather_location():
    p = IntentParser()
    assert p.parse_intent("weather in Boston")["location"] == "Boston"


def test_unknown_falls_back_to_conversation():
    p = IntentParser()
    result = p.parse_intent("just thinking out loud about life")
    assert result["type"] == "conversation"
    assert result["action_required"] is False


def test_empty_input():
    p = IntentParser()
    assert p.parse_intent("")["type"] == "unknown"


def test_action_required_for_canned_intents():
    p = IntentParser()
    for utterance in ["tell me a joke", "hello", "help", "goodbye"]:
        assert p.parse_intent(utterance)["action_required"] is True
