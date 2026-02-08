#!/usr/bin/env python3
"""
Fix duplicate and malformed TL;DR sections in section 12.
"""

import re
from pathlib import Path

BASE_DIR = Path("wdrozenia/modules/tools/catalog")
CATEGORIES = ["strategy", "operations", "transformation"]

def fix_section_12(file_path: Path) -> bool:
    """Fix duplicate TL;DR in section 12."""
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  ✗ Error reading {file_path}: {e}")
        return False
    
    # Find section 12
    section_12_match = re.search(r'^## 12\.\s+.*?\n(.*?)(?=\n## 13\.|\Z)', content, re.DOTALL)
    if not section_12_match:
        return False
    
    section_12 = section_12_match.group(1)
    section_start = section_12_match.start(1)
    section_end = section_12_match.end(1)
    
    # Find all TL;DR sections
    tldr_matches = list(re.finditer(r'### TL;DR[^\n]*\n\n(.*?)(?=\n###|\n##|\Z)', section_12, re.DOTALL))
    
    if len(tldr_matches) <= 1:
        return False
    
    # Keep only the last (usually the good one) or the longest one
    if len(tldr_matches) > 1:
        # Find the best TL;DR (longest, no placeholders)
        best_tldr = None
        best_idx = -1
        best_score = 0
        
        for i, match in enumerate(tldr_matches):
            tldr_content = match.group(1).strip()
            score = len(tldr_content)
            # Penalize if has placeholders
            if "###" in tldr_content or "[Answer" in tldr_content or "outputs are specific" in tldr_content.lower():
                score -= 1000
            if score > best_score:
                best_score = score
                best_tldr = match
                best_idx = i
        
        # Remove all TL;DR except the best one
        new_section_12 = section_12
        for i, match in enumerate(reversed(tldr_matches)):
            if i != len(tldr_matches) - 1 - best_idx:
                new_section_12 = new_section_12[:match.start()] + new_section_12[match.end():]
        
        # Update content
        new_content = content[:section_start] + new_section_12 + content[section_end:]
        file_path.write_text(new_content, encoding="utf-8")
        return True
    
    return False

def main():
    """Main function."""
    print("=" * 80)
    print("FIX DUPLICATE TL;DR")
    print("=" * 80)
    print()
    
    total_fixed = 0
    
    for category in CATEGORIES:
        category_dir = BASE_DIR / category
        if not category_dir.exists():
            continue
        
        md_files = sorted(category_dir.glob("*.md"))
        md_files = [f for f in md_files if not f.name.startswith("00-")]
        
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
