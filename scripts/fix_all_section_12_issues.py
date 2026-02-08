#!/usr/bin/env python3
"""
Fix all section 12 issues: remove duplicates, add missing elements, format FAQs properly.
"""

import re
from pathlib import Path

BASE_DIR = Path("wdrozenia/modules/tools/catalog")
CATEGORIES = ["strategy", "operations", "transformation"]

def extract_metadata(content: str) -> dict:
    """Extract metadata for KB pack."""
    metadata = {}
    
    name_match = re.search(r'\*\*Tool name\*\*:\s*(.+)', content)
    if name_match:
        metadata['tool_name'] = name_match.group(1).strip()
    
    # Try multiple patterns for purpose/goal
    purpose_match = re.search(r'## 1\.\s+Purpose[^\n]*\n\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
    if purpose_match:
        purpose_text = purpose_match.group(1).strip()
        # Try to extract goal from various patterns
        goal_match = re.search(r'answers?[:\s]+["\'](.+?)["\']', purpose_text, re.IGNORECASE)
        if not goal_match:
            goal_match = re.search(r'### 1\.1\s+Goal[^\n]*\n(.*?)(?=\n###|\n##|\Z)', content, re.DOTALL)
        if goal_match:
            metadata['goal'] = goal_match.group(1).strip()
        else:
            # Use first sentence or first 200 chars
            first_sentence = purpose_text.split('.')[0] if '.' in purpose_text else purpose_text[:200]
            metadata['goal'] = first_sentence.strip()[:200] + "..." if len(first_sentence) > 200 else first_sentence.strip()
    
    # If still no goal, try to get from tool description
    if not metadata.get('goal') or len(metadata.get('goal', '')) < 10:
        best_for_match = re.search(r'\*\*Best for\*\*:\s*(.+)', content)
        if best_for_match:
            metadata['goal'] = best_for_match.group(1).strip()
    
    outputs_match = re.search(r'\*\*Primary outputs\*\*:\s*(.+)', content)
    if outputs_match:
        metadata['outputs'] = outputs_match.group(1).strip()
    
    when_match = re.search(r'### 1\.2\s+When to use[^\n]*\n(.*?)(?=\n###|\n##|\Z)', content, re.DOTALL)
    if when_match:
        when_text = when_match.group(1).strip()
        # Clean up bullet points
        when_text = re.sub(r'^-\s+', '', when_text, flags=re.MULTILINE)
        when_text = re.sub(r'\n-', ', ', when_text)
        metadata['when_to_use'] = when_text[:200] + "..." if len(when_text) > 200 else when_text
    else:
        # Try alternative pattern
        when_match = re.search(r'\*\*Best for\*\*:\s*(.+)', content)
        if when_match:
            metadata['when_to_use'] = when_match.group(1).strip()
    
    return metadata

def fix_section_12(file_path: Path) -> bool:
    """Fix section 12 completely."""
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  ✗ Error reading {file_path}: {e}")
        return False
    
    # Find section 12 - try multiple patterns
    section_12_match = re.search(r'## 12\.\s+.*?\n(.*?)(?=\n## 13\.|\Z)', content, re.DOTALL)
    if not section_12_match:
        return False
    
    section_12 = section_12_match.group(1)
    section_start = section_12_match.start(1)
    section_end = section_12_match.end(1)
    original_section_12 = section_12
    
    metadata = extract_metadata(content)
    tool_name = metadata.get('tool_name', 'this tool')
    goal = metadata.get('goal', 'solve business problems')
    outputs = metadata.get('outputs', 'analysis results and recommendations')
    when_to_use = metadata.get('when_to_use', 'when you need structured analysis')
    
    # Clean up goal and ensure it's not empty
    goal = re.sub(r'###\s*\d+\.\d+\s+goal', '', goal, flags=re.IGNORECASE).strip()
    goal = re.sub(r'outputs are specific[^.]*\.', '', goal, flags=re.IGNORECASE).strip()
    goal = re.sub(r'^\.\s*', '', goal).strip()
    
    # If goal is still empty or too short, use a default based on category
    if not goal or len(goal) < 10:
        category = file_path.parent.name
        if category == "transformation":
            goal = "create structured, evidence-backed artifacts and convert gaps into initiatives"
        elif category == "operations":
            goal = "improve processes and operational excellence"
        else:
            goal = "provide strategic analysis and decision support"
    
    goal = goal[:150] + "..." if len(goal) > 150 else goal
    
    # Clean up when_to_use
    when_to_use = re.sub(r'^-\s+', '', when_to_use, flags=re.MULTILINE).strip()
    when_to_use = re.sub(r'\n-', ', ', when_to_use)
    if not when_to_use or len(when_to_use) < 10:
        when_to_use = "you need structured analysis and decision support"
    
    updated = False
    
    # Remove all TL;DR sections (duplicates and malformed)
    tldr_matches = list(re.finditer(r'### TL;DR[^\n]*\n\n(.*?)(?=\n###|\n##|\Z)', section_12, re.DOTALL))
    if len(tldr_matches) > 0:
        updated = True  # Mark as updated since we'll fix TL;DR
        # Check if any TL;DR is valid
        has_valid_tldr = False
        best_tldr_content = None
        
        for match in tldr_matches:
            tldr_content = match.group(1).strip()
            # Check if it's valid (long enough, no placeholders)
            is_valid = (len(tldr_content) > 200 and 
                       "###" not in tldr_content and 
                       "[Answer" not in tldr_content and 
                       "outputs are specific" not in tldr_content.lower() and
                       "helps outputs are" not in tldr_content.lower() and
                       "You must convert" not in tldr_content)
            
            if is_valid:
                has_valid_tldr = True
                best_tldr_content = tldr_content
                break
        
        # Remove ALL TL;DR sections (we'll add a proper one)
        for match in reversed(tldr_matches):
            section_12 = section_12[:match.start()] + section_12[match.end():]
        
        # Always add proper TL;DR (use existing if valid, otherwise generate new)
        if has_valid_tldr and best_tldr_content:
            # Use the valid one we found
            proper_tldr = f"""### TL;DR (5–8 sentences)

{best_tldr_content}

"""
        else:
            # Generate new TL;DR
            # Generate better TL;DR based on category and tool purpose
            category = file_path.parent.name
            goal_short = goal[:150] + "..." if len(goal) > 150 else goal
            when_short = when_to_use[:150] + "..." if len(when_to_use) > 150 else when_to_use
            
            if category == "transformation":
                tldr_text = f"{tool_name} is a transformation tool that creates a structured, evidence-backed artifact and converts gaps into initiatives with traceability for the roadmap. It helps {goal_short.lower()}. Key outputs include {outputs}. Use it {when_short.lower()}. The tool ensures comprehensive assessment and actionable roadmap. Success depends on leadership commitment, stakeholder alignment, and systematic execution."
            elif category == "operations":
                tldr_text = f"{tool_name} is an operations tool that helps {goal_short.lower()}. It provides a systematic approach to process improvement and operational excellence. Key outputs include {outputs}. Use it {when_short.lower()}. The tool ensures evidence-based improvements and actionable recommendations. Success depends on data quality, team engagement, and continuous improvement mindset."
            else:  # strategy
                tldr_text = f"{tool_name} is a strategy tool that helps {goal_short.lower()}. It provides a systematic approach to strategic analysis and decision-making. Key outputs include {outputs}. Use it {when_short.lower()}. The tool ensures comprehensive analysis and actionable strategic insights. Success depends on clear objectives, complete data, and systematic execution."
            
            proper_tldr = f"""### TL;DR (5–8 sentences)

{tldr_text}

"""
        
        # Insert TL;DR after section header (remove empty TL;DR headers first)
        # Remove empty TL;DR headers like "### " or "### TL;DR" without content
        section_12 = re.sub(r'###\s*TL;DR[^\n]*\n\n\s*###', '###', section_12)
        section_12 = re.sub(r'###\s*\n', '', section_12)
        
        header_match = re.search(r'## 12\.', section_12, re.MULTILINE)
        if header_match:
            header_end = section_12.find('\n', header_match.end())
            if header_end < 0:
                header_end = len(section_12)
            # Check if TL;DR already exists after header (with content)
            after_header = section_12[header_end+1:header_end+200]
            tldr_match_after = re.search(r'###\s*TL;DR[^\n]*\n\n(.+?)(?=\n###|\n##|\Z)', after_header, re.DOTALL)
            if not tldr_match_after or len(tldr_match_after.group(1).strip()) < 50:
                section_12 = section_12[:header_end+1] + proper_tldr + section_12[header_end+1:]
                updated = True
        else:
            # No header found, prepend
            section_12 = proper_tldr + section_12
            updated = True
    
    # Fix FAQs (add answers if missing or replace if malformed)
    faq_section_match = re.search(r'### FAQ[^\n]*\n(.*?)(?=\n###|\n##|\Z)', section_12, re.DOTALL)
    if faq_section_match:
        faq_content = faq_section_match.group(1)
        # Check if FAQs have answers
        faq_lines = faq_content.split('\n')
        has_answers = any('A:' in line or 'Answer:' in line or '**A:**' in line for line in faq_lines)
        
        # Also check if questions are numbered properly
        question_count = len(re.findall(r'^\d+\.\s+', faq_content, re.MULTILINE))
        
        # Check for malformed FAQ (has "outputs are specific" or similar)
        has_malformed = "outputs are specific" in faq_content.lower() or "You must convert" in faq_content or "helps ." in faq_content
        
        if not has_answers or question_count < 5 or has_malformed:
            # Replace FAQ section with proper FAQs
            proper_faqs = f"""
### FAQ (at least 8)

1. **What is the main purpose of {tool_name}?**
   A: {tool_name} helps {goal.lower()[:100] if len(goal) < 100 else goal[:100] + "..."}.

2. **When should I use {tool_name}?**
   A: Use it {when_to_use.lower()[:150] if len(when_to_use) < 150 else when_to_use[:150] + "..."}.

3. **What are the key outputs?**
   A: Key outputs include {outputs}.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good {tool_name} analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
"""
            section_12 = section_12[:faq_section_match.start()] + proper_faqs + section_12[faq_section_match.end():]
            updated = True
    else:
        # No FAQ section at all - add it
        proper_faqs = f"""
### FAQ (at least 8)

1. **What is the main purpose of {tool_name}?**
   A: {tool_name} helps {goal.lower()[:100] if len(goal) < 100 else goal[:100] + "..."}.

2. **When should I use {tool_name}?**
   A: Use it {when_to_use.lower()[:150] if len(when_to_use) < 150 else when_to_use[:150] + "..."}.

3. **What are the key outputs?**
   A: Key outputs include {outputs}.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good {tool_name} analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
"""
        # Insert before checklist or glossary
        checklist_pos = section_12.lower().find('checklist')
        glossary_pos = section_12.lower().find('glossary')
        insert_pos = min(checklist_pos, glossary_pos) if checklist_pos > 0 and glossary_pos > 0 else (checklist_pos if checklist_pos > 0 else (glossary_pos if glossary_pos > 0 else len(section_12)))
        section_12 = section_12[:insert_pos] + proper_faqs + section_12[insert_pos:]
        updated = True
    
    # Add checklist if missing
    if "checklist" not in section_12.lower():
        checklist = """
### Checklists

**DoD Checklist (Definition of Done):**
- [ ] All required inputs provided
- [ ] Analysis completed according to method
- [ ] Key insights documented
- [ ] Recommendations generated
- [ ] Report exportable

**Common Mistakes Checklist:**
- [ ] Incomplete inputs → Fix: Ensure all required inputs are provided before starting
- [ ] Skipping validation → Fix: Validate results and check for consistency
- [ ] Unclear objectives → Fix: Define clear objectives and success criteria upfront
"""
        # Insert before glossary or at end
        glossary_pos = section_12.lower().find('glossary')
        separator_pos = section_12.find('\n---\n')
        insert_pos = min(glossary_pos, separator_pos) if glossary_pos > 0 and separator_pos > 0 else (glossary_pos if glossary_pos > 0 else (separator_pos if separator_pos > 0 else len(section_12)))
        section_12 = section_12[:insert_pos] + checklist + section_12[insert_pos:]
        updated = True
    
    # Add glossary if missing
    if "glossary" not in section_12.lower():
        glossary = """
### Glossary (short)

| Term | Definition | Example |
|------|------------|---------|
| Analysis | Systematic examination of data and information | Conducting analysis to identify patterns |
| Insights | Key findings and conclusions from analysis | Deriving insights from data patterns |
| Recommendations | Actionable suggestions based on analysis | Providing recommendations for improvement |
"""
        # Insert before --- separator or at end
        separator_pos = section_12.find('\n---\n')
        insert_pos = separator_pos if separator_pos > 0 else len(section_12)
        section_12 = section_12[:insert_pos] + glossary + section_12[insert_pos:]
        updated = True
    
    # Always check if glossary is missing
    if "glossary" not in section_12.lower():
        glossary = """
### Glossary (short)

| Term | Definition | Example |
|------|------------|---------|
| Analysis | Systematic examination of data and information | Conducting analysis to identify patterns |
| Insights | Key findings and conclusions from analysis | Deriving insights from data patterns |
| Recommendations | Actionable suggestions based on analysis | Providing recommendations for improvement |
"""
        separator_pos = section_12.find('\n---\n')
        insert_pos = separator_pos if separator_pos > 0 else len(section_12)
        section_12 = section_12[:insert_pos] + glossary + section_12[insert_pos:]
        updated = True
    
    if updated:
        new_content = content[:section_start] + section_12 + content[section_end:]
        file_path.write_text(new_content, encoding="utf-8")
        return True
    
    return False

def main():
    """Main function."""
    print("=" * 80)
    print("FIX ALL SECTION 12 ISSUES")
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
        
        # Process all files
        for md_file in md_files:
            if fix_section_12(md_file):
                print(f"  ✓ Fixed {md_file.name}")
                total_fixed += 1
    
    print("\n" + "=" * 80)
    print(f"SUMMARY: {total_fixed} files fixed")
    print("=" * 80)
    
    return 0

if __name__ == "__main__":
    exit(main())
