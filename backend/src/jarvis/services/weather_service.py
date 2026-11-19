"""Weather and AQI lookup — Google Maps Platform first, then OpenWeatherMap / WeatherAPI fallbacks."""

from __future__ import annotations

import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
WEATHERAPI_URL = "https://api.weatherapi.com/v1/current.json"
GEO_URL = "http://ip-api.com/json/"
GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
GOOGLE_WEATHER_URL = "https://weather.googleapis.com/v1/currentConditions:lookup"
GOOGLE_AQI_URL = "https://airquality.googleapis.com/v1/currentConditions:lookup"


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


def _geocode(location: str, api_key: str) -> Optional[tuple[float, float]]:
    """Return (lat, lng) for a location string using Google Geocoding API."""
    try:
        r = requests.get(GOOGLE_GEOCODE_URL, params={"address": location, "key": api_key}, timeout=8)
        r.raise_for_status()
        results = r.json().get("results", [])
        if not results:
            return None
        loc = results[0]["geometry"]["location"]
        return loc["lat"], loc["lng"]
    except Exception as exc:
        logger.warning("Geocoding failed for '%s': %s", location, exc)
        return None


def _from_google(location: str, api_key: str) -> Optional[str]:
    coords = _geocode(location, api_key)
    if not coords:
        return None
    lat, lng = coords
    try:
        r = requests.get(
            GOOGLE_WEATHER_URL,
            params={"key": api_key, "location.latitude": lat, "location.longitude": lng},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as exc:
        logger.warning("Google Weather API failed: %s", exc)
        return None
    try:
        temp = data["temperature"]["degrees"]
        feels = data["feelsLikeTemperature"]["degrees"]
        humidity = data["humidity"]["relativeHumidity"]
        condition = data["weatherCondition"]["description"]["text"]
        unit = "°F" if _is_us(location) else "°C"
        return (
            f"The weather in {location} is {condition} with a temperature of "
            f"{temp:.1f}{unit}. It feels like {feels:.1f}{unit} and humidity is {humidity}%."
        )
    except (KeyError, TypeError) as exc:
        logger.warning("Google Weather response parse error: %s", exc)
        return None


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
    location = location or _current_location()

    maps_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("WEATHER_API_KEY", "")
    if maps_key.startswith("AIzaSy"):
        result = _from_google(location, maps_key)
        if result:
            return result

    openweather_key = os.environ.get("OPENWEATHER_API_KEY")
    if openweather_key:
        result = _from_openweather(location, openweather_key)
        if result:
            return result

    weatherapi_key = os.environ.get("WEATHER_API_KEY")
    if weatherapi_key and not weatherapi_key.startswith("AIzaSy"):
        result = _from_weatherapi(location, weatherapi_key)
        if result:
            return result

    if not maps_key and not openweather_key and not weatherapi_key:
        return "Weather is not configured. Set GOOGLE_MAPS_API_KEY or OPENWEATHER_API_KEY to enable real-time weather."
    return f"I couldn't retrieve weather for {location} right now."


def get_aqi(location: Optional[str] = None) -> str:
    location = location or _current_location()

    maps_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("WEATHER_API_KEY", "")
    if not maps_key.startswith("AIzaSy"):
        return "Air quality data requires a Google Maps API key (GOOGLE_MAPS_API_KEY)."

    coords = _geocode(location, maps_key)
    if not coords:
        return f"Could not determine coordinates for '{location}'."

    lat, lng = coords
    try:
        r = requests.post(
            GOOGLE_AQI_URL,
            params={"key": maps_key},
            json={
                "location": {"latitude": lat, "longitude": lng},
                "extraComputations": ["HEALTH_RECOMMENDATIONS", "DOMINANT_POLLUTANT_CONCENTRATION"],
            },
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as exc:
        logger.warning("Google AQI API failed: %s", exc)
        return f"Could not retrieve air quality data for {location} right now."

    try:
        idx = data["indexes"][0]
        aqi_val = idx.get("aqi", "N/A")
        category = idx.get("category", "")
        pollutant = idx.get("dominantPollutant", "")
        rec = data.get("healthRecommendations", {}).get("generalPopulation", "")
        parts = [f"Air quality in {location}: AQI {aqi_val} ({category})."]
        if pollutant:
            parts.append(f"Dominant pollutant: {pollutant}.")
        if rec:
            parts.append(f"Recommendation: {rec}")
        return " ".join(parts)
    except (KeyError, IndexError, TypeError) as exc:
        logger.warning("Google AQI response parse error: %s", exc)
        return f"Could not parse air quality data for {location}."
