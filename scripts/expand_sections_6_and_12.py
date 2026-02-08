#!/usr/bin/env python3
"""
Automatically expand sections 6 (UI/Graphic spec) and 12 (KB pack) for tool documentation files.
Uses templates based on well-filled examples.
"""

import re
from pathlib import Path
from typing import Dict, List, Tuple

BASE_DIR = Path("wdrozenia/modules/tools/catalog")
CATEGORIES = ["strategy", "operations", "transformation"]

# Template for section 6 expansion (basic structure)
SECTION_6_EXPANSION = """
### 6.2 Layout requirements

**Two-column layout:**
- Left workspace: scrollable, full height
- Right control panel: sticky top, max-height: 100vh, overflow-y: auto
- Responsive: on mobile/tablet, control panel becomes bottom sheet

### 6.3 Interactions

**General interactions:**
- Click elements to edit inline or open detail modals
- Drag-and-drop to rearrange items
- Filter and sort tables
- Auto-save: every 30 seconds or on blur
- Undo/redo: keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
- Keyboard navigation: Tab through editable fields, Enter to save

### 6.4 States

**Draft:**
- All sections editable
- No export available (except draft PDF)
- "Review" button enabled

**In Review:**
- Sections locked (read-only) except for comments/annotations
- "Approve" and "Reject" buttons enabled for reviewers
- Export available (draft PDF)

**Approved:**
- All sections locked (read-only)
- "Generate Initiatives" button enabled
- Export available (final PDF, Excel)
- Can create new version (supersedes previous)

**Visual States:**
- Loading: skeleton screens for tables/charts
- Error: inline error messages below fields, toast notifications for save failures
- Success: green checkmark animations, toast notifications for saves

### 6.5 Export formats

**PDF Export:**
- Cover page: Tool name, company, date, owner
- Table of contents
- Executive Summary
- Analysis results
- Recommendations
- Action Plan (from initiatives)
- Appendices: Definitions, references

**Excel Export:**
- Multiple sheets: Data, Analysis, Results
- Formatted tables with filters
- Charts embedded as images

**Print Preview:**
- Optimized layout for A4/Letter
- Page breaks at logical sections
- Headers/footers with page numbers
"""

# Template for section 12 expansion
SECTION_12_TLDR_TEMPLATE = """### TL;DR (5–8 sentences)

{tool_name} is {purpose_description}. {key_benefit}. {method_summary}. {outputs_summary}. {when_to_use}. {key_differentiator}. {success_factor}.
"""

SECTION_12_FAQ_TEMPLATE = """### FAQ (at least 8)

1. **What is the main purpose of {tool_name}?**
   A: {purpose_answer}

2. **When should I use {tool_name}?**
   A: {when_to_use_answer}

3. **What are the key outputs?**
   A: {outputs_answer}

4. **What are common mistakes?**
   A: {common_mistakes_answer}

5. **How do I ensure quality results?**
   A: {quality_answer}

6. **What inputs are required?**
   A: {inputs_answer}

7. **How long does it typically take?**
   A: {duration_answer}

8. **What makes a good {tool_name} analysis?**
   A: {good_analysis_answer}
"""

SECTION_12_CHECKLIST_TEMPLATE = """### Checklists

**DoD Checklist (Definition of Done):**
- [ ] All required inputs provided
- [ ] Analysis completed according to method
- [ ] Key insights documented
- [ ] Recommendations generated
- [ ] Report exportable

**Common Mistakes Checklist:**
- [ ] {mistake1} → Fix: {fix1}
- [ ] {mistake2} → Fix: {fix2}
- [ ] {mistake3} → Fix: {fix3}
"""

SECTION_12_GLOSSARY_TEMPLATE = """### Glossary (short)

| Term | Definition | Example |
|------|------------|---------|
| {term1} | {def1} | {ex1} |
| {term2} | {def2} | {ex2} |
| {term3} | {def3} | {ex3} |
"""

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

def extract_metadata_for_kb(content: str) -> Dict[str, str]:
    """Extract metadata needed for KB pack."""
    metadata = {}
    
    # Extract tool name
    name_match = re.search(r'\*\*Tool name\*\*:\s*(.+)', content)
    if name_match:
        metadata['tool_name'] = name_match.group(1).strip()
    
    # Extract purpose
    purpose_match = re.search(r'## 1\.\s+Purpose[^\n]*\n\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
    if purpose_match:
        purpose_text = purpose_match.group(1).strip()
        # Try to extract goal
        goal_match = re.search(r'answers?[:\s]+["\'](.+?)["\']', purpose_text, re.IGNORECASE)
        if goal_match:
            metadata['goal'] = goal_match.group(1).strip()
        else:
            metadata['goal'] = purpose_text[:150] + "..." if len(purpose_text) > 150 else purpose_text
    
    # Extract method summary
    method_match = re.search(r'## [34]\.\s+Method[^\n]*\n\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
    if method_match:
        method_text = method_match.group(1).strip()
        metadata['method'] = method_text[:200] + "..." if len(method_text) > 200 else method_text
    
    # Extract outputs
    outputs_match = re.search(r'\*\*Primary outputs\*\*:\s*(.+)', content)
    if outputs_match:
        metadata['outputs'] = outputs_match.group(1).strip()
    
    # Extract when to use
    when_match = re.search(r'### 1\.2\s+When to use[^\n]*\n(.*?)(?=\n###|\n##|\Z)', content, re.DOTALL)
    if when_match:
        when_text = when_match.group(1).strip()
        metadata['when_to_use'] = when_text[:200] + "..." if len(when_text) > 200 else when_text
    
    # Extract duration
    duration_match = re.search(r'\*\*Typical duration\*\*:\s*(.+)', content)
    if duration_match:
        metadata['duration'] = duration_match.group(1).strip()
    
    # Extract inputs
    inputs_match = re.search(r'\*\*Required inputs[^\n]*\*\*:\s*\n(.*?)(?=\n\*\*|\n##|\Z)', content, re.DOTALL)
    if inputs_match:
        inputs_text = inputs_match.group(1).strip()
        metadata['inputs'] = inputs_text[:200] + "..." if len(inputs_text) > 200 else inputs_text
    
    return metadata

def needs_section_6_expansion(content: str) -> bool:
    """Check if section 6 needs expansion."""
    section_6, _, _ = extract_section_content(content, 6)
    
    if not section_6:
        return True
    
    word_count = len(section_6.split())
    return word_count < 200

def needs_section_12_expansion(content: str) -> bool:
    """Check if section 12 needs expansion."""
    section_12, _, _ = extract_section_content(content, 12)
    
    if not section_12:
        return True
    
    # Check for TL;DR
    has_tldr = "tldr" in section_12.lower() or "executive summary" in section_12.lower()
    
    # Check for FAQ count
    faq_matches = len(re.findall(r'^\d+\.\s+.*\?', section_12, re.MULTILINE))
    
    # Check for checklist
    has_checklist = "checklist" in section_12.lower()
    
    # Check for glossary
    has_glossary = "glossary" in section_12.lower()
    
    word_count = len(section_12.split())
    
    return not (has_tldr and faq_matches >= 5 and has_checklist and has_glossary) or word_count < 300

def expand_section_6(content: str, file_path: Path) -> str:
    """Expand section 6 if needed."""
    section_6, start_idx, end_idx = extract_section_content(content, 6)
    
    if not section_6:
        # Insert new section 6 before section 7
        section_7_match = re.search(r'^## 7\.', content, re.MULTILINE)
        if section_7_match:
            insert_pos = section_7_match.start()
            # Get tool name for header
            tool_name_match = re.search(r'\*\*Tool name\*\*:\s*(.+)', content)
            tool_name = tool_name_match.group(1).strip() if tool_name_match else "Tool"
            
            new_section_6 = f"""## 6. UI / Graphic specification

> Use the canonical 2-column layout from Tools: **left = workspace**, **right = control panel**.

### 6.1 Screens / views

**Workspace (left column, 65% width):**
- Setup and configuration
- Main analysis workspace
- Results visualization

**Control Panel (right column, 35% width, sticky):**
- Status badge (Draft/In Review/Approved)
- DoD checklist (expandable)
- Action buttons: Review, Approve, Export PDF, Generate Initiatives
- Session metadata (created date, last updated, owner)
{SECTION_6_EXPANSION}

---
"""
            content = content[:insert_pos] + new_section_6 + content[insert_pos:]
            return content
    
    # Expand existing section 6 if too short
    if needs_section_6_expansion(content):
        # Check if it already has subsections
        if "### 6.2" not in section_6:
            # Append expansion
            new_content = section_6.rstrip() + "\n" + SECTION_6_EXPANSION
            content = content[:start_idx] + new_content + content[end_idx:]
            return content
    
    return content

def expand_section_12(content: str, file_path: Path) -> str:
    """Expand section 12 if needed."""
    section_12, start_idx, end_idx = extract_section_content(content, 12)
    metadata = extract_metadata_for_kb(content)
    
    if not section_12:
        # Insert new section 12 before section 13
        section_13_match = re.search(r'^## 13\.', content, re.MULTILINE)
        if section_13_match:
            insert_pos = section_13_match.start()
            
            tool_name = metadata.get('tool_name', 'this tool')
            purpose = metadata.get('goal', 'solve business problems')
            
            new_section_12 = f"""## 12. Knowledge base extraction pack

{SECTION_12_TLDR_TEMPLATE.format(
    tool_name=tool_name,
    purpose_description=f"a tool that helps {purpose.lower()}",
    key_benefit="It provides a systematic approach to analysis and decision-making.",
    method_summary=f"The method involves {metadata.get('method', 'step-by-step analysis')[:100]}.",
    outputs_summary=f"Key outputs include {metadata.get('outputs', 'analysis results and recommendations')}.",
    when_to_use=f"Use it when {metadata.get('when_to_use', 'you need structured analysis')[:100]}.",
    key_differentiator="The tool ensures comprehensive and actionable insights.",
    success_factor="Success depends on thorough data collection and systematic execution."
)}

{SECTION_12_FAQ_TEMPLATE.format(
    tool_name=tool_name,
    purpose_answer=f"{tool_name} helps {purpose.lower()}.",
    when_to_use_answer=metadata.get('when_to_use', 'When you need structured analysis and decision support.'),
    outputs_answer=metadata.get('outputs', 'Analysis results, insights, and actionable recommendations.'),
    common_mistakes_answer="Common mistakes include incomplete data, skipping validation steps, and unclear objectives.",
    quality_answer="Ensure all required inputs are provided, follow the method systematically, and validate results.",
    inputs_answer=metadata.get('inputs', 'Required inputs include scope, objectives, and relevant data.'),
    duration_answer=metadata.get('duration', 'Typically takes 60-120 minutes depending on complexity.'),
    good_analysis_answer="A good analysis has clear objectives, complete data, systematic execution, and actionable insights."
)}

{SECTION_12_CHECKLIST_TEMPLATE.format(
    mistake1="Incomplete inputs",
    fix1="Ensure all required inputs are provided before starting",
    mistake2="Skipping validation",
    fix2="Validate results and check for consistency",
    mistake3="Unclear objectives",
    fix3="Define clear objectives and success criteria upfront"
)}

{SECTION_12_GLOSSARY_TEMPLATE.format(
    term1="Analysis",
    def1="Systematic examination of data and information",
    ex1="Conducting analysis to identify patterns",
    term2="Insights",
    def2="Key findings and conclusions from analysis",
    ex2="Deriving insights from data patterns",
    term3="Recommendations",
    def3="Actionable suggestions based on analysis",
    ex3="Providing recommendations for improvement"
)}

---
"""
            content = content[:insert_pos] + new_section_12 + content[insert_pos:]
            return content
    
    # Expand existing section 12 if incomplete
    if needs_section_12_expansion(content):
        # Check what's missing and add it
        section_12_lower = section_12.lower()
        
        # Check if TL;DR exists but is malformed (has placeholders or is too short)
        tldr_match = re.search(r'### TL;DR[^\n]*\n\n(.*?)(?=\n###|\n##|\Z)', section_12, re.DOTALL)
        has_valid_tldr = False
        if tldr_match:
            tldr_content = tldr_match.group(1).strip()
            # Check if it's a real TL;DR (not placeholder)
            if len(tldr_content) > 100 and "###" not in tldr_content and "[Answer" not in tldr_content:
                has_valid_tldr = True
        
        if not has_valid_tldr:
            # Remove ALL TL;DR sections (malformed ones)
            while True:
                tldr_match = re.search(r'### TL;DR[^\n]*\n\n(.*?)(?=\n###|\n##|\Z)', section_12, re.DOTALL)
                if not tldr_match:
                    break
                tldr_content = tldr_match.group(1).strip()
                # Remove if malformed (has placeholders, too short, or has markdown artifacts)
                if len(tldr_content) < 100 or "###" in tldr_content or "[Answer" in tldr_content or "outputs are specific" in tldr_content.lower():
                    section_12 = section_12[:tldr_match.start()] + section_12[tldr_match.end():]
                else:
                    break
            
            # Add proper TL;DR at the beginning
            tool_name = metadata.get('tool_name', 'this tool')
            purpose = metadata.get('goal', 'solve business problems')
            # Clean up purpose (remove markdown artifacts)
            purpose = re.sub(r'###\s*\d+\.\d+\s+goal', '', purpose, flags=re.IGNORECASE).strip()
            purpose = re.sub(r'outputs are specific[^.]*\.', '', purpose, flags=re.IGNORECASE).strip()
            purpose = purpose[:150] + "..." if len(purpose) > 150 else purpose
            
            # Get better purpose from Purpose section
            purpose_section_match = re.search(r'## 1\.\s+Purpose[^\n]*\n\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
            if purpose_section_match:
                purpose_text = purpose_section_match.group(1).strip()
                goal_match = re.search(r'answers?[:\s]+["\'](.+?)["\']', purpose_text, re.IGNORECASE)
                if goal_match:
                    purpose = goal_match.group(1).strip()
                elif len(purpose_text) < 200:
                    purpose = purpose_text
            
            tldr = f"""### TL;DR (5–8 sentences)

{tool_name} is a tool that helps {purpose.lower() if len(purpose) < 100 else purpose[:100] + "..."}. It provides a systematic approach to analysis and decision-making. The method involves {metadata.get('method', 'step-by-step analysis')[:100]}. Key outputs include {metadata.get('outputs', 'analysis results and recommendations')}. Use it when {metadata.get('when_to_use', 'you need structured analysis')[:100]}. The tool ensures comprehensive and actionable insights. Success depends on thorough data collection and systematic execution.

"""
            # Insert after section header
            header_end = section_12.find('\n', section_12.find('## 12'))
            if header_end > 0:
                section_12 = section_12[:header_end+1] + tldr + section_12[header_end+1:]
                content = content[:start_idx] + section_12 + content[end_idx:]
                return content
        
        # Check FAQ count
        faq_matches = len(re.findall(r'^\d+\.\s+.*\?', section_12, re.MULTILINE))
        if faq_matches < 5:
            # Add more FAQs
            tool_name = metadata.get('tool_name', 'this tool')
            additional_faqs = f"""
{6 + faq_matches}. **What inputs are required?**
   A: {metadata.get('inputs', 'Required inputs include scope, objectives, and relevant data.')}

{7 + faq_matches}. **How long does it typically take?**
   A: {metadata.get('duration', 'Typically takes 60-120 minutes depending on complexity.')}

{8 + faq_matches}. **What makes a good {tool_name} analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, and actionable insights.
"""
            # Append before checklist or glossary
            checklist_pos = section_12.lower().find('checklist')
            glossary_pos = section_12.lower().find('glossary')
            insert_pos = min(checklist_pos, glossary_pos) if checklist_pos > 0 and glossary_pos > 0 else len(section_12)
            if insert_pos == len(section_12):
                insert_pos = section_12.rfind('\n')
            
            new_section_12 = section_12[:insert_pos] + additional_faqs + section_12[insert_pos:]
            content = content[:start_idx] + new_section_12 + content[end_idx:]
            return content
        
        # Check for checklist
        checklist_match = re.search(r'###.*[Cc]hecklist', section_12, re.MULTILINE)
        if not checklist_match:
            # Add checklist
            checklist = SECTION_12_CHECKLIST_TEMPLATE.format(
                mistake1="Incomplete inputs",
                fix1="Ensure all required inputs are provided before starting",
                mistake2="Skipping validation",
                fix2="Validate results and check for consistency",
                mistake3="Unclear objectives",
                fix3="Define clear objectives and success criteria upfront"
            )
            # Append before glossary or at end (before --- separator)
            glossary_pos = section_12.lower().find('glossary')
            separator_pos = section_12.find('\n---\n')
            insert_pos = min(glossary_pos, separator_pos) if glossary_pos > 0 and separator_pos > 0 else (glossary_pos if glossary_pos > 0 else (separator_pos if separator_pos > 0 else len(section_12)))
            new_section_12 = section_12[:insert_pos] + "\n\n" + checklist + section_12[insert_pos:]
            content = content[:start_idx] + new_section_12 + content[end_idx:]
            return content
        
        # Check for glossary
        glossary_match = re.search(r'###.*[Gg]lossary', section_12, re.MULTILINE)
        if not glossary_match:
            # Add glossary
            glossary = SECTION_12_GLOSSARY_TEMPLATE.format(
                term1="Analysis",
                def1="Systematic examination of data and information",
                ex1="Conducting analysis to identify patterns",
                term2="Insights",
                def2="Key findings and conclusions from analysis",
                ex2="Deriving insights from data patterns",
                term3="Recommendations",
                def3="Actionable suggestions based on analysis",
                ex3="Providing recommendations for improvement"
            )
            # Append before --- separator or at end
            separator_pos = section_12.find('\n---\n')
            insert_pos = separator_pos if separator_pos > 0 else len(section_12)
            new_section_12 = section_12[:insert_pos] + "\n\n" + glossary + section_12[insert_pos:]
            content = content[:start_idx] + new_section_12 + content[end_idx:]
            return content
    
    return content

def update_file(file_path: Path) -> bool:
    """Update a single file."""
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  ✗ Error reading {file_path}: {e}")
        return False
    
    updated = False
    
    # Expand section 6 if needed
    if needs_section_6_expansion(content):
        content = expand_section_6(content, file_path)
        updated = True
        print(f"  ✓ Expanded section 6 in {file_path.name}")
    
    # Expand section 12 if needed
    if needs_section_12_expansion(content):
        content = expand_section_12(content, file_path)
        updated = True
        print(f"  ✓ Expanded section 12 in {file_path.name}")
    
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
    print("EXPAND SECTIONS 6 & 12")
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
        skip_files = ["balanced-scorecard.md", "5s.md", "sales-and-operations-planning-sn-op.md", "scor-model.md"]
        
        for md_file in md_files:
            if md_file.name in skip_files:
                print(f"  ⊘ Skipping {md_file.name} (already fixed manually)")
                continue
            
            if update_file(md_file):
                total_updated += 1
    
    print("\n" + "=" * 80)
    print(f"SUMMARY: {total_updated} files updated")
    print("=" * 80)
    
    return 0

if __name__ == "__main__":
    exit(main())
