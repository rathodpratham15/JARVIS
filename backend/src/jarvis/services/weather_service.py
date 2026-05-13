"""Weather lookup via OpenWeatherMap, with WeatherAPI.com as fallback."""

from __future__ import annotations

import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
WEATHERAPI_URL = "https://api.weatherapi.com/v1/current.json"
GEO_URL = "http://ip-api.com/json/"


def _is_us(location: str) -> bool:
    return "United States" in location or location.endswith(", US")


def _current_location() -> str:
    try:
        response = requests.get(GEO_URL, timeout=5)
        response.raise_for_status()
        data = response.json()
        if data.get("status") == "success":
            return f"{data.get('city', 'Unknown')}, {data.get('country', '')}".strip(", ")
    except requests.RequestException as exc:
        logger.warning("Location detection failed: %s", exc)
    return "your current location"


def _from_openweather(location: str, api_key: str) -> Optional[str]:
    units = "imperial" if _is_us(location) else "metric"
    unit_label = "°F" if units == "imperial" else "°C"
    try:
        response = requests.get(
            OPENWEATHER_URL,
            params={"q": location, "appid": api_key, "units": units},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        logger.warning("OpenWeatherMap request failed: %s", exc)
        return None
    try:
        return (
            f"The weather in {data['name']}, {data['sys']['country']} is "
            f"{data['weather'][0]['description']} with a temperature of "
            f"{data['main']['temp']}{unit_label}. It feels like "
            f"{data['main']['feels_like']}{unit_label} and humidity is "
            f"{data['main']['humidity']}%."
        )
    except (KeyError, IndexError) as exc:
        logger.warning("OpenWeatherMap response parse error: %s", exc)
        return None


def _from_weatherapi(location: str, api_key: str) -> Optional[str]:
    try:
        response = requests.get(
            WEATHERAPI_URL,
            params={"key": api_key, "q": location, "aqi": "no"},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        logger.warning("WeatherAPI.com request failed: %s", exc)
        return None
    try:
        current = data["current"]
        loc = data["location"]
        if _is_us(location):
            temp = current["temp_f"]
            feels = current["feelslike_f"]
            unit = "°F"
        else:
            temp = current["temp_c"]
            feels = current["feelslike_c"]
            unit = "°C"
        return (
            f"The weather in {loc['name']}, {loc['country']} is "
            f"{current['condition']['text']} with a temperature of "
            f"{temp:.1f}{unit}. It feels like {feels:.1f}{unit} and humidity is "
            f"{current['humidity']}%."
        )
    except (KeyError, IndexError) as exc:
        logger.warning("WeatherAPI.com response parse error: %s", exc)
        return None


def get_weather(location: Optional[str] = None) -> str:
    """Return a human-readable weather summary for `location`.

    Falls back to IP-based location detection if `location` is None.
    Returns a configuration message if no API keys are set.
    """
    location = location or _current_location()

    openweather_key = os.environ.get("OPENWEATHER_API_KEY")
    if openweather_key:
        result = _from_openweather(location, openweather_key)
        if result:
            return result

    weatherapi_key = os.environ.get("WEATHER_API_KEY")
    if weatherapi_key:
        result = _from_weatherapi(location, weatherapi_key)
        if result:
            return result

    if not openweather_key and not weatherapi_key:
        return "Weather is not configured. Set OPENWEATHER_API_KEY to enable real-time weather."
    return f"I couldn't retrieve weather for {location} right now."
