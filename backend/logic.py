"""Documented demonstration rules, not AI inference or external synchronization."""
from __future__ import annotations


def classify_interaction(event: dict) -> tuple[bool, bool, str, str]:
    """Return (outreach, engagement, confidence, explanation).

    The caller supplies flags such as `meaningful`, `two_way`, and `attended`.
    A production integration would first need permission, deduplication and reliable evidence.
    """
    kind = str(event.get('kind', '')).lower()
    meaningful = event.get('meaningful') is True
    direction = event.get('direction', '')
    if kind == 'call':
        length = event.get('duration_seconds', 0)
        connected = event.get('connected') is True
        try:
            seconds = float(length)
        except (TypeError, ValueError):
            seconds = 0
        if connected and seconds > 120:
            return (direction == 'outbound', True, 'metadata', 'Connected call strictly longer than 2 minutes')
        return (False, False, 'metadata', 'Missed or short call: does not reset relationship dates')
    if kind == 'email':
        outreach = meaningful and direction == 'outbound'
        engagement = meaningful and event.get('two_way') is True
        return (outreach, engagement, 'user-labelled', 'Meaningful outreach and two-way engagement are tracked separately')
    if kind == 'text':
        outreach = meaningful and direction == 'outbound'
        engagement = meaningful and event.get('two_way') is True
        return (outreach, engagement, 'user-labelled', 'Text conversation classified for outreach and engagement')
    if kind in ('calendar', 'meeting'):
        status = event.get('attendance', 'scheduled')
        if status in ('inferred', 'confirmed'):
            return (False, True, status, 'Likely attended' if status == 'inferred' else 'Attendance confirmed')
        return (False, False, 'calendar', 'Scheduled, canceled or unverified event: no engagement')
    return (False, False, 'recorded', 'Activity retained without resetting a relationship timer')
