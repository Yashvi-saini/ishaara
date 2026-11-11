# Demo script

A 2-minute demo video of the full flow. Record with demo mode on (`DEMO_MODE=true`), so each guard rings for 8 seconds.

## Setup

| Device                  | Page       | Before recording                                                 |
| ----------------------- | ---------- | ---------------------------------------------------------------- |
| Laptop with webcam      | `/eye`     | Camera location set to "Parking, camera 4". Allow camera access. |
| Second laptop or window | `/command` | Click "Turn on alarm sound".                                     |
| Phone 1                 | `/guard`   | Pick Anil Yadav, tap "Start shift". Volume up.                   |
| Phone 2                 | `/guard`   | Pick Ramesh Kumar, tap "Start shift". Volume up.                 |

For the parking camera, Ishaara rings Anil first, then Ramesh, then Sunita. Check that Command shows "1 of 6 cameras online" and "2 of 3 guards on shift" before you start.

Optional: with Twilio set up (see the README), each guard's phone is also called and pressing 1 confirms. Without it, the Guard app rings on its own.

Backup: if the camera cannot see the signal on the day, press Shift+S on the Eye page (or click "Simulate signal"). The alert is marked as simulated.

## Script

| Time      | On screen               | Say                                                                                                         |
| --------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| 0:00–0:15 | Home page               | "In danger, the phone and the voice are the first things an attacker controls. Ishaara needs only a hand."  |
| 0:15–0:30 | Learn page, three steps | "This is the international Signal for Help: palm with the thumb tucked in, then fingers folded over it."    |
| 0:30–0:45 | Eye page, make the sign | "A camera that is already on campus watches for it. Here it sees step one, then the fold."                  |
| 0:45–1:05 | Command                 | "Security sees the parking camera flash on the map, with one snapshot. Anil's phone is ringing."            |
| 1:05–1:20 | Phone 1, then Phone 2   | "Anil doesn't answer in 8 seconds, so Ishaara rings Ramesh. Ramesh taps I'm going."                         |
| 1:20–1:35 | Command                 | "The dashboard shows Ramesh is on the way, with a timer and the full ring timeline."                        |
| 1:35–1:50 | Command, Resolve        | "Ramesh checks in calmly. If she asks, he calls 112. Security resolves the alert and it stays in the log."  |
| 1:50–2:00 | Home, privacy card      | "No faces identified. No video recorded. A person always decides. No app. No phone. No words. Just a hand." |

## After recording

- Restart the server to clear the alert log before a live demo (alerts are kept in memory only).
- If the deployed service has been idle, open it a minute before presenting: the free Render plan sleeps after 15 minutes without traffic.
