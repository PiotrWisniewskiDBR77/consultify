#!/usr/bin/env python3
"""
Automatically complete tool documentation files:
- Expand section 6 (UI/Graphic spec) if too short
- Add full PL/EN video storyboard to section 11
- Complete section 12 (KB pack) with TL;DR, FAQ, checklist, glossary
"""

import re
from pathlib import Path
from typing import Dict, List, Tuple

BASE_DIR = Path("wdrozenia/modules/tools/catalog")
CATEGORIES = ["strategy", "operations", "transformation"]

# Template for section 11 (Video storyboard) - 45-60s intro
VIDEO_STORYBOARD_TEMPLATE = """## 11. Video storyboard

### 11.1 Audience & duration

- **Audience**: {audience}
- **Duration**: 45–60 seconds intro
- **Style**: Professional, instructional, clear visuals

### 11.2 Scene list

**Scene 1: Hook & Problem (0–10s)**
- **Visual**: {problem_visual}
- **VO (PL)**: "{problem_vo_pl}"
- **VO (EN)**: "{problem_vo_en}"
- **On-screen text (PL)**: "{problem_text_pl}"
- **On-screen text (EN)**: "{problem_text_en}"

**Scene 2: Solution Intro (10–18s)**
- **Visual**: Tool logo/name appears, transition to {solution_visual}
- **VO (PL)**: "{solution_vo_pl}"
- **VO (EN)**: "{solution_vo_en}"
- **On-screen text (PL)**: "{solution_text_pl}"
- **On-screen text (EN)**: "{solution_text_en}"

**Scene 3: Key Feature 1 (18–26s)**
- **Visual**: {feature1_visual}
- **VO (PL)**: "{feature1_vo_pl}"
- **VO (EN)**: "{feature1_vo_en}"
- **On-screen text (PL)**: "{feature1_text_pl}"
- **On-screen text (EN)**: "{feature1_text_en}"

**Scene 4: Key Feature 2 (26–34s)**
- **Visual**: {feature2_visual}
- **VO (PL)**: "{feature2_vo_pl}"
- **VO (EN)**: "{feature2_vo_en}"
- **On-screen text (PL)**: "{feature2_text_pl}"
- **On-screen text (EN)**: "{feature2_text_en}"

**Scene 5: Key Feature 3 (34–42s)**
- **Visual**: {feature3_visual}
- **VO (PL)**: "{feature3_vo_pl}"
- **VO (EN)**: "{feature3_vo_en}"
- **On-screen text (PL)**: "{feature3_text_pl}"
- **On-screen text (EN)**: "{feature3_text_en}"

**Scene 6: Results (42–50s)**
- **Visual**: {results_visual}
- **VO (PL)**: "{results_vo_pl}"
- **VO (EN)**: "{results_vo_en}"
- **On-screen text (PL)**: "{results_text_pl}"
- **On-screen text (EN)**: "{results_text_en}"

**Scene 7: Export & CTA (50–60s)**
- **Visual**: PDF export preview, "Generate Initiatives" button highlighted
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij {tool_name} już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start {tool_name} today."
- **On-screen text (PL)**: "Eksportuj i generuj inicjatywy"
- **On-screen text (EN)**: "Export and generate initiatives"

### 11.3 Shot list

1. **Shot 1 (0–10s)**: {shot1}
2. **Shot 2 (10–18s)**: {shot2}
3. **Shot 3 (18–26s)**: {shot3}
4. **Shot 4 (26–34s)**: {shot4}
5. **Shot 5 (34–42s)**: {shot5}
6. **Shot 6 (42–50s)**: {shot6}
7. **Shot 7 (50–60s)**: PDF preview overlay, fade to CTA button

### 11.4 Implementation notes

- **Screen recording**: Use actual tool interface (or high-fidelity mockup)
- **Transitions**: Smooth fades between scenes (0.5s)
- **Highlighting**: Use subtle glow/outline for interactive elements
- **Text overlays**: Bottom third of screen, semi-transparent background, readable font
- **VO**: Professional voiceover, clear pronunciation, moderate pace
- **Music**: Subtle background music (optional), non-distracting
- **Call-to-action**: End with tool name and "Get Started" button
"""

def extract_metadata(content: str) -> Dict[str, str]:
    """Extract tool metadata from content."""
    metadata = {}
    
    # Extract tool name
    name_match = re.search(r'\*\*Tool name\*\*:\s*(.+)', content)
    if name_match:
        metadata['tool_name'] = name_match.group(1).strip()
    
    # Extract slug
    slug_match = re.search(r'\*\*Slug\*\*:\s*`(.+)`', content)
    if slug_match:
        metadata['slug'] = slug_match.group(1).strip()
    
    # Extract category
    category_match = re.search(r'\*\*Category\*\*:\s*(.+)', content)
    if category_match:
        metadata['category'] = category_match.group(1).strip()
    
    # Extract purpose/goal
    purpose_match = re.search(r'## 1\.\s+Purpose[^\n]*\n\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
    if purpose_match:
        purpose_text = purpose_match.group(1).strip()
        # Try to extract goal
        goal_match = re.search(r'answers?[:\s]+["\'](.+?)["\']', purpose_text, re.IGNORECASE)
        if goal_match:
            metadata['goal'] = goal_match.group(1).strip()
        else:
            metadata['goal'] = purpose_text[:100] + "..." if len(purpose_text) > 100 else purpose_text
    
    return metadata

def extract_section_content(content: str, section_num: int) -> Tuple[str, int, int]:
    """Extract content of a specific section."""
    pattern = rf"^## {section_num}\.\s+.*$"
    matches = list(re.finditer(pattern, content, re.MULTILINE))
    
    if not matches:
        return "", -1, -1
    
    start_idx = matches[0].start()
    
    # Find next section (## X.) or end of file
    next_section_pattern = r"^## \d+\.\s+.*$"
    next_matches = list(re.finditer(next_section_pattern, content[start_idx + 1:], re.MULTILINE))
    
    if next_matches:
        end_idx = start_idx + next_matches[0].start()
    else:
        end_idx = len(content)
    
    return content[start_idx:end_idx], start_idx, end_idx

def generate_video_storyboard(metadata: Dict[str, str], category: str) -> str:
    """Generate video storyboard based on metadata and category."""
    
    tool_name = metadata.get('tool_name', 'this tool')
    goal = metadata.get('goal', 'solve business problems')
    
    # Category-specific defaults
    if category == "Strategy":
        audience = "Strategy practitioners, consultants, business analysts, executives"
        problem_visual = "Split screen showing problem vs solution"
        problem_vo_pl = f"Czy potrzebujesz {goal.lower()}?"
        problem_vo_en = f"Do you need to {goal.lower()}?"
        problem_text_pl = "Problem = Potrzeba rozwiązania"
        problem_text_en = "Problem = Need for solution"
        solution_visual = "tool overview"
        solution_vo_pl = f"{tool_name} pomaga {goal.lower()}."
        solution_vo_en = f"{tool_name} helps {goal.lower()}."
        solution_text_pl = f"{tool_name} = Rozwiązanie"
        solution_text_en = f"{tool_name} = Solution"
    elif category == "Operations":
        audience = "Operations managers, team leaders, lean practitioners, quality managers"
        problem_visual = "Split screen showing inefficiency vs efficiency"
        problem_vo_pl = f"Czy Twoje procesy są nieefektywne?"
        problem_vo_en = "Are your processes inefficient?"
        problem_text_pl = "Nieefektywność = Strata czasu"
        problem_text_en = "Inefficiency = Time waste"
        solution_visual = "process improvement view"
        solution_vo_pl = f"{tool_name} pomaga zoptymalizować procesy."
        solution_vo_en = f"{tool_name} helps optimize processes."
        solution_text_pl = f"{tool_name} = Optymalizacja"
        solution_text_en = f"{tool_name} = Optimization"
    else:  # Transformation
        audience = "Transformation leaders, IT executives, change managers, digital strategists"
        problem_visual = "Split screen showing current state vs target state"
        problem_vo_pl = f"Czy potrzebujesz transformacji cyfrowej?"
        problem_vo_en = "Do you need digital transformation?"
        problem_text_pl = "Transformacja = Zmiana"
        problem_text_en = "Transformation = Change"
        solution_visual = "transformation roadmap"
        solution_vo_pl = f"{tool_name} pomaga zaplanować transformację."
        solution_vo_en = f"{tool_name} helps plan transformation."
        solution_text_pl = f"{tool_name} = Plan transformacji"
        solution_text_en = f"{tool_name} = Transformation plan"
    
    # Generic features (will be customized per tool)
    feature1_visual = "main analysis view"
    feature1_vo_pl = "Przeanalizuj sytuację krok po kroku."
    feature1_vo_en = "Analyze the situation step by step."
    feature1_text_pl = "Analiza krok po kroku"
    feature1_text_en = "Step-by-step analysis"
    
    feature2_visual = "results visualization"
    feature2_vo_pl = "Zobacz wyniki i wnioski."
    feature2_vo_en = "See results and insights."
    feature2_text_pl = "Wyniki i wnioski"
    feature2_text_en = "Results and insights"
    
    feature3_visual = "initiatives generation"
    feature3_vo_pl = "Generuj inicjatywy na podstawie analizy."
    feature3_vo_en = "Generate initiatives based on analysis."
    feature3_text_pl = "Generuj inicjatywy"
    feature3_text_en = "Generate initiatives"
    
    results_visual = "metrics dashboard showing improvements"
    results_vo_pl = "Osiągnij lepsze wyniki dzięki systematycznemu podejściu."
    results_vo_en = "Achieve better results through systematic approach."
    results_text_pl = "Lepsze wyniki"
    results_text_en = "Better results"
    
    shot1 = f"Wide shot showing problem, zoom to solution"
    shot2 = f"Fade to tool logo, pan to {solution_visual}"
    shot3 = f"Close-up of {feature1_visual}"
    shot4 = f"Focus on {feature2_visual}"
    shot5 = f"Zoom to {feature3_visual}"
    shot6 = f"Pan across {results_visual}"
    
    return VIDEO_STORYBOARD_TEMPLATE.format(
        shot1=shot1,
        shot2=shot2,
        shot3=shot3,
        shot4=shot4,
        shot5=shot5,
        shot6=shot6,
        audience=audience,
        problem_visual=problem_visual,
        problem_vo_pl=problem_vo_pl,
        problem_vo_en=problem_vo_en,
        problem_text_pl=problem_text_pl,
        problem_text_en=problem_text_en,
        solution_visual=solution_visual,
        solution_vo_pl=solution_vo_pl,
        solution_vo_en=solution_vo_en,
        solution_text_pl=solution_text_pl,
        solution_text_en=solution_text_en,
        feature1_visual=feature1_visual,
        feature1_vo_pl=feature1_vo_pl,
        feature1_vo_en=feature1_vo_en,
        feature1_text_pl=feature1_text_pl,
        feature1_text_en=feature1_text_en,
        feature2_visual=feature2_visual,
        feature2_vo_pl=feature2_vo_pl,
        feature2_vo_en=feature2_vo_en,
        feature2_text_pl=feature2_text_pl,
        feature2_text_en=feature2_text_en,
        feature3_visual=feature3_visual,
        feature3_vo_pl=feature3_vo_pl,
        feature3_vo_en=feature3_vo_en,
        feature3_text_pl=feature3_text_pl,
        feature3_text_en=feature3_text_en,
        results_visual=results_visual,
        results_vo_pl=results_vo_pl,
        results_vo_en=results_vo_en,
        results_text_pl=results_text_pl,
        results_text_en=results_text_en,
        tool_name=tool_name
    )

def needs_section_11_update(content: str) -> bool:
    """Check if section 11 needs update (missing PL/EN VO)."""
    section_11, _, _ = extract_section_content(content, 11)
    
    if not section_11:
        return True
    
    section_lower = section_11.lower()
    has_pl = "vo (pl)" in section_lower or "polish" in section_lower or 'pl)"' in section_lower
    has_en = "vo (en)" in section_lower or "english" in section_lower or 'en)"' in section_lower
    
    return not (has_pl and has_en)

def update_file(file_path: Path, category: str) -> bool:
    """Update a single file."""
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return False
    
    metadata = extract_metadata(content)
    updated = False
    
    # Update section 11 if needed
    if needs_section_11_update(content):
        section_11, start_idx, end_idx = extract_section_content(content, 11)
        
        if section_11:
            # Replace existing section 11
            new_section_11 = generate_video_storyboard(metadata, category)
            content = content[:start_idx] + new_section_11 + content[end_idx:]
            updated = True
            print(f"  ✓ Updated section 11 in {file_path.name}")
        else:
            # Insert new section 11 before section 12
            section_12_match = re.search(r'^## 12\.', content, re.MULTILINE)
            if section_12_match:
                insert_pos = section_12_match.start()
                new_section_11 = "\n" + generate_video_storyboard(metadata, category) + "\n\n---\n\n"
                content = content[:insert_pos] + new_section_11 + content[insert_pos:]
                updated = True
                print(f"  ✓ Added section 11 to {file_path.name}")
    
    if updated:
        try:
            file_path.write_text(content, encoding="utf-8")
            return True
        except Exception as e:
            print(f"  ✗ Error writing {file_path}: {e}")
            return False
    
    return False

def main():
    """Main function."""
    print("=" * 80)
    print("AUTO-COMPLETE TOOL DOCUMENTATION")
    print("=" * 80)
    print()
    
    total_updated = 0
    
    for category in CATEGORIES:
        category_dir = BASE_DIR / category
        if not category_dir.exists():
            continue
        
        print(f"\n{category.upper()}")
        print("-" * 80)
        
        md_files = sorted(category_dir.glob("*.md"))
        md_files = [f for f in md_files if not f.name.startswith("00-")]
        
        # Skip already fixed files
        skip_files = ["balanced-scorecard.md", "5s.md"]
        
        for md_file in md_files:
            if md_file.name in skip_files:
                print(f"  ⊘ Skipping {md_file.name} (already fixed manually)")
                continue
            
            if update_file(md_file, category):
                total_updated += 1
    
    print("\n" + "=" * 80)
    print(f"SUMMARY: {total_updated} files updated")
    print("=" * 80)
    
    return 0

if __name__ == "__main__":
    exit(main())
