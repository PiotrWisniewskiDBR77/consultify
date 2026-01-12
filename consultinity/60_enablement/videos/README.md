# Consultinity Video Tutorials

This directory contains video tutorial scripts and the produced video files.

## File Naming Convention

Each video has a matching script file:
- Script: `XX-name.md` (HeyGen avatar script)
- Video: `XX-name.mp4` (Produced video file)

## Video List

| # | Script | Video | Duration | Module |
|---|--------|-------|----------|--------|
| 01 | `01-consultinity-welcome.md` | `01-consultinity-welcome.mp4` | 5:30 | Onboarding |
| 02 | `02-first-steps-profile.md` | `02-first-steps-profile.mp4` | 3:45 | Onboarding |
| 03 | `03-platform-navigation.md` | `03-platform-navigation.mp4` | 4:15 | Onboarding |
| 04 | `04-dashboard-overview.md` | `04-dashboard-overview.mp4` | 6:00 | Dashboard |
| 05 | `05-dashboard-customization.md` | `05-dashboard-customization.mp4` | 4:30 | Dashboard |
| 06 | `06-assessment-intro.md` | `06-assessment-intro.mp4` | 8:00 | Assessment |
| 07 | `07-drd-walkthrough.md` | `07-drd-walkthrough.mp4` | 15:00 | Assessment |
| 08 | `08-assessment-evidence.md` | `08-assessment-evidence.mp4` | 5:30 | Assessment |
| 09 | `09-gap-analysis.md` | `09-gap-analysis.mp4` | 7:15 | Assessment |
| 10 | `10-initiative-generation.md` | `10-initiative-generation.mp4` | 6:45 | Initiatives |
| 11 | `11-prioritization-matrix.md` | `11-prioritization-matrix.mp4` | 5:30 | Initiatives |
| 12 | `12-business-case.md` | `12-business-case.mp4` | 8:00 | Initiatives |
| 13 | `13-roadmap-creation.md` | `13-roadmap-creation.mp4` | 9:00 | Roadmap |
| 14 | `14-dependencies-resources.md` | `14-dependencies-resources.mp4` | 7:30 | Roadmap |
| 15 | `15-pilot-program.md` | `15-pilot-program.mp4` | 10:00 | Implementation |
| 16 | `16-stage-gate-process.md` | `16-stage-gate-process.mp4` | 6:30 | Implementation |
| 17 | `17-adkar-change-management.md` | `17-adkar-change-management.mp4` | 8:45 | Implementation |
| 18 | `18-roi-calculation.md` | `18-roi-calculation.mp4` | 7:00 | Reports |
| 19 | `19-executive-reports.md` | `19-executive-reports.mp4` | 5:15 | Reports |

**Total Runtime:** ~2 hours 14 minutes

## Production Workflow

### 1. HeyGen Avatar Recording
1. Open script file (e.g., `01-consultinity-welcome.md`)
2. Copy the "Avatar Script" section
3. Paste into HeyGen text-to-speech
4. Generate video with avatar speaking

### 2. Screen Recording  
Follow "Visual Notes for Editor" in each script file.

### 3. Post-Production
1. Combine avatar + screen recordings
2. Add transitions and chapter markers
3. Export as MP4 (1080p)
4. Save to this directory with matching filename

### 4. Update Codebase
After producing a video, update `config/videoTutorialsContent.ts` with the actual video URL.

## Script Format

Each script contains:
- **Metadata** - Video ID, filename, duration, difficulty
- **Avatar Script** - Timestamped text for HeyGen
- **Key Points** - Summary for reference
- **Visual Notes** - Screen recording instructions
