#!/usr/bin/env python3
"""
Complete section 6 (UI/Graphic specification) for all tool documentation files.
Adds missing sections and expands incomplete ones based on template.
"""

import re
from pathlib import Path

BASE_DIR = Path("wdrozenia/modules/tools/catalog")
CATEGORIES = ["strategy", "operations", "transformation"]

# Template for complete section 6
SECTION_6_TEMPLATE = """## 6. UI / Graphic specification

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

### 6.2 Layout requirements

**Two-column layout:**
- Left workspace: scrollable, full height
- Right control panel: sticky top, max-height: 100vh, overflow-y: auto
- Responsive: on mobile/tablet, control panel becomes bottom sheet

**Visual design:**
- Clean, modern interface with consistent spacing
- Color-coded elements for different states and categories
- Clear typography hierarchy (headings, body text, labels)
- Interactive elements with hover states and feedback

### 6.3 Interactions

**General interactions:**
- Click elements to edit inline or open detail modals
- Drag-and-drop to rearrange items
- Filter and sort tables
- Auto-save: every 30 seconds or on blur
- Undo/redo: keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
- Keyboard navigation: Tab through editable fields, Enter to save

**Specific interactions:**
- Add/edit/delete items with confirmation dialogs
- Bulk actions: select multiple items for batch operations
- Context menus: right-click for additional options
- Tooltips: hover over elements for additional information

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
- Empty: helpful prompts with examples and guidance

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

---
"""

def extract_tool_info(content: str) -> dict:
    """Extract tool-specific information for customizing section 6."""
    info = {}
    
    # Extract tool name
    name_match = re.search(r'\*\*Tool name\*\*:\s*(.+)', content)
    if name_match:
        info['tool_name'] = name_match.group(1).strip()
    
    # Extract primary outputs
    outputs_match = re.search(r'\*\*Primary outputs\*\*:\s*(.+)', content)
    if outputs_match:
        info['outputs'] = outputs_match.group(1).strip()
    
    return info

def has_section_6(content: str) -> bool:
    """Check if section 6 exists."""
    # Check for numbered section 6
    if re.search(r'^## 6\.\s+UI', content, re.MULTILINE):
        return True
    # Check for unnumbered UI/Graphic spec
    if re.search(r'^##\s+UI\s+/\s+Graphic', content, re.MULTILINE):
        return True
    return False

def get_section_6_content(content: str) -> tuple:
    """Extract section 6 content and its position."""
    # Try numbered section first
    match = re.search(r'^## 6\.\s+UI.*?\n(.*?)(?=\n## 7\.|\n## 8\.|\n## 10\.|\Z)', content, re.DOTALL | re.MULTILINE)
    if match:
        return match.group(1), match.start(), match.end()
    
    # Try unnumbered UI/Graphic spec
    match = re.search(r'^##\s+UI\s+/\s+Graphic.*?\n(.*?)(?=\n##|\Z)', content, re.DOTALL | re.MULTILINE)
    if match:
        return match.group(1), match.start(), match.end()
    
    return None, -1, -1

def is_section_6_complete(section_6_content: str) -> bool:
    """Check if section 6 is complete (has all required subsections)."""
    if not section_6_content:
        return False
    
    word_count = len(section_6_content.split())
    if word_count < 200:
        return False
    
    # Check for required subsections
    has_6_1 = '6.1' in section_6_content or 'Screens' in section_6_content or 'views' in section_6_content.lower()
    has_6_2 = '6.2' in section_6_content or 'Layout' in section_6_content
    has_6_3 = '6.3' in section_6_content or 'Interactions' in section_6_content
    has_6_4 = '6.4' in section_6_content or 'States' in section_6_content
    has_6_5 = '6.5' in section_6_content or 'Export' in section_6_content
    
    return has_6_1 and has_6_2 and has_6_3 and has_6_4 and has_6_5

def complete_section_6(file_path: Path) -> bool:
    """Complete section 6 for a file."""
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  ✗ Error reading {file_path}: {e}")
        return False
    
    tool_info = extract_tool_info(content)
    section_6_content, start_idx, end_idx = get_section_6_content(content)
    
    updated = False
    
    if not has_section_6(content):
        # Add new section 6 before section 7
        section_7_match = re.search(r'^## 7\.', content, re.MULTILINE)
        if section_7_match:
            insert_pos = section_7_match.start()
            content = content[:insert_pos] + SECTION_6_TEMPLATE + content[insert_pos:]
            updated = True
            print(f"  ✓ Added section 6 to {file_path.name}")
    elif section_6_content and not is_section_6_complete(section_6_content):
        # Replace incomplete section 6 with complete one
        # Find and remove old section 6 - try multiple patterns
        section_header_match = re.search(r'^##\s+(6\.\s+)?UI\s+/\s+Graphic', content, re.MULTILINE)
        if not section_header_match:
            # Try without ^ anchor
            section_header_match = re.search(r'##\s+(6\.\s+)?UI\s+/\s+Graphic', content, re.MULTILINE)
        
        if section_header_match:
            # Find end of section 6 (next ## section)
            start_pos = section_header_match.start()
            remaining = content[start_pos:]
            
            # Find next section (## 7, 8, 9, 10, or Worked example)
            next_section_match = re.search(r'\n##\s+[789]\.', remaining, re.MULTILINE)
            if not next_section_match:
                next_section_match = re.search(r'\n##\s+10\.', remaining, re.MULTILINE)
            if not next_section_match:
                next_section_match = re.search(r'\n##\s+Worked\s+example', remaining, re.MULTILINE | re.IGNORECASE)
            if not next_section_match:
                next_section_match = re.search(r'\n##\s+[0-9]+\.', remaining, re.MULTILINE)
            
            if next_section_match:
                section_end = start_pos + next_section_match.start()
            else:
                section_end = len(content)
            
            # Replace old section with new complete one
            content = content[:start_pos] + SECTION_6_TEMPLATE + content[section_end:]
            updated = True
            print(f"  ✓ Replaced section 6 in {file_path.name}")
            if updated:
                try:
                    file_path.write_text(content, encoding="utf-8")
                    return True
                except Exception as e:
                    print(f"  ✗ Error writing {file_path}: {e}")
                    return False
            return False
        
        # Fallback: Expand existing section 6
        # Check what's missing and add it
        if '6.2' not in section_6_content or 'Layout requirements' not in section_6_content:
            # Add layout requirements
            layout_section = """
### 6.2 Layout requirements

**Two-column layout:**
- Left workspace: scrollable, full height
- Right control panel: sticky top, max-height: 100vh, overflow-y: auto
- Responsive: on mobile/tablet, control panel becomes bottom sheet

**Visual design:**
- Clean, modern interface with consistent spacing
- Color-coded elements for different states and categories
- Clear typography hierarchy (headings, body text, labels)
- Interactive elements with hover states and feedback

"""
            # Insert after 6.1 or at appropriate place
            pos_6_1 = section_6_content.find('6.1')
            pos_6_3 = section_6_content.find('6.3')
            if pos_6_1 >= 0 and pos_6_3 > pos_6_1:
                insert_pos = pos_6_3
            else:
                insert_pos = len(section_6_content) // 2
            section_6_content = section_6_content[:insert_pos] + layout_section + section_6_content[insert_pos:]
            updated = True
        
        # Add missing subsections if needed
        if '6.3' not in section_6_content or 'Interactions' not in section_6_content:
            interactions_section = """
### 6.3 Interactions

**General interactions:**
- Click elements to edit inline or open detail modals
- Drag-and-drop to rearrange items
- Filter and sort tables
- Auto-save: every 30 seconds or on blur
- Undo/redo: keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
- Keyboard navigation: Tab through editable fields, Enter to save

**Specific interactions:**
- Add/edit/delete items with confirmation dialogs
- Bulk actions: select multiple items for batch operations
- Context menus: right-click for additional options
- Tooltips: hover over elements for additional information

"""
            pos_6_2 = section_6_content.find('6.2')
            pos_6_4 = section_6_content.find('6.4')
            if pos_6_2 >= 0 and pos_6_4 > pos_6_2:
                insert_pos = pos_6_4
            else:
                insert_pos = len(section_6_content) * 2 // 3
            section_6_content = section_6_content[:insert_pos] + interactions_section + section_6_content[insert_pos:]
            updated = True
        
        if '6.4' not in section_6_content or 'States' not in section_6_content:
            states_section = """
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
- Empty: helpful prompts with examples and guidance

"""
            pos_6_3 = section_6_content.find('6.3')
            pos_6_5 = section_6_content.find('6.5')
            if pos_6_3 >= 0 and pos_6_5 > pos_6_3:
                insert_pos = pos_6_5
            else:
                insert_pos = len(section_6_content) * 3 // 4
            section_6_content = section_6_content[:insert_pos] + states_section + section_6_content[insert_pos:]
            updated = True
        
        if '6.5' not in section_6_content or 'Export' not in section_6_content:
            export_section = """
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
            section_6_content = section_6_content.rstrip() + "\n" + export_section
            updated = True
        
        if updated:
            # Replace section 6 in content
            # Find the section header
            section_header_match = re.search(r'^##\s+(6\.\s+)?UI\s+/\s+Graphic', content, re.MULTILINE)
            if section_header_match:
                header_end = content.find('\n', section_header_match.end())
                new_section_6 = content[section_header_match.start():header_end+1] + section_6_content
                content = content[:section_header_match.start()] + new_section_6 + content[end_idx:]
                updated = True
                print(f"  ✓ Expanded section 6 in {file_path.name}")
    
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
    print("COMPLETE SECTION 6 (UI/GRAPHIC SPECIFICATION)")
    print("=" * 80)
    print()
    
    total_fixed = 0
    
    for category in CATEGORIES:
        category_dir = BASE_DIR / category
        if not category_dir.exists():
            continue
        
        print(f"\n{category.upper()}")
        print("-" * 80)
        
        md_files = sorted(category_dir.glob("*.md"))
        md_files = [f for f in md_files if not f.name.startswith("00-")]
        
        for md_file in md_files:
            if complete_section_6(md_file):
                total_fixed += 1
    
    print("\n" + "=" * 80)
    print(f"SUMMARY: {total_fixed} files updated")
    print("=" * 80)
    
    return 0

if __name__ == "__main__":
    exit(main())
