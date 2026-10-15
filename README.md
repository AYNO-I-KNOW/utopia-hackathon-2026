# utopia-hackathon-2026
AYNO team - U-topia Hackathon

## Mobile wireframe

Buildless HTML prototype. Run locally:

```sh
python3 -m http.server 4175 --bind 127.0.0.1
```

Open http://127.0.0.1:4175. No installation or build is required.

The starting screen is the activity timeline. Bottom navigation links to child development, cry-pattern analysis, and doctor consultation. The latter two unfinished sections (development and consultation) are placeholders.

Cry-analysis flow: microphone → recording → confirm → loading → result → chat or save activity. Recording waveform, analysis results, and AI replies are simulated; no microphone or AI service is connected. The timer tracks elapsed time. Activity date/time defaults to the current Bangkok time and can be edited. Activities persist only in this browser's localStorage, not in a backend.

Keep this first pass low fidelity, mobile only, and concise. Current layout follows the reviewed wireframe rather than a final visual design.
