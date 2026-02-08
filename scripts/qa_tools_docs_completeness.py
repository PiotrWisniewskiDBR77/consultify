#!/usr/bin/env python3
"""
QA script to check completeness of tool documentation files:
- Section 6 (UI/Graphic specification) - detailed graphic description
- Section 11 (Video storyboard) - full PL/EN scenario
- Section 12 (Knowledge base extraction pack) - help system texts
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Tuple

BASE_DIR = Path("wdrozenia/modules/tools/catalog")
CATEGORIES = ["strategy", "operations", "transformation"]

def extract_section_content(content: str, section_num: int) -> Tuple[str, int, int]:
    """Extract content of a specific section."""
    # Match section headers like "## 6. UI / Graphic specification" or "## 6. UI/Graphic specification"
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

def check_section_6_quality(content: str) -> Dict[str, any]:
    """Check if section 6 has detailed graphic specification."""
    section, _, _ = extract_section_content(content, 6)
    
    if not section:
        return {"exists": False, "score": 0, "issues": ["Section 6 not found"]}
    
    issues = []
    score = 0
    
    # Check for key elements
    checks = {
        "layout": ["layout", "column", "workspace", "panel"],
        "visual_design": ["visual", "design", "color", "shape", "icon"],
        "interactions": ["interaction", "click", "hover", "drag", "select"],
        "states": ["state", "draft", "approved", "loading"],
        "export": ["export", "pdf", "excel"],
        "mockup": ["mockup", "sketch", "diagram", "chart", "table"]
    }
    
    section_lower = section.lower()
    
    for check_name, keywords in checks.items():
        found = any(kw in section_lower for kw in keywords)
        if found:
            score += 1
        else:
            issues.append(f"Missing {check_name} details")
    
    # Check length (should be substantial)
    word_count = len(section.split())
    if word_count < 200:
        issues.append(f"Section too short ({word_count} words, expected 200+)")
        score -= 1
    
    return {
        "exists": True,
        "score": max(0, score),
        "max_score": len(checks),
        "word_count": word_count,
        "issues": issues
    }

def check_section_11_quality(content: str) -> Dict[str, any]:
    """Check if section 11 has full PL/EN video storyboard."""
    section, _, _ = extract_section_content(content, 11)
    
    if not section:
        return {"exists": False, "score": 0, "issues": ["Section 11 not found"]}
    
    issues = []
    score = 0
    
    # Check for key elements
    checks = {
        "audience": ["audience", "duration"],
        "scenes": ["scene", "visual", "vo"],
        "polish_vo": ["vo (pl)", "vo (polish)", "polski", "pl)"],
        "english_vo": ["vo (en)", "vo (english)", "english", "en)"],
        "on_screen_text": ["on-screen", "text", "pl)", "en)"],
        "shot_list": ["shot", "list", "implementation"]
    }
    
    section_lower = section.lower()
    
    for check_name, keywords in checks.items():
        found = any(kw in section_lower for kw in keywords)
        if found:
            score += 1
        else:
            issues.append(f"Missing {check_name}")
    
    # Check for bilingual content
    has_pl = "pl)" in section_lower or "polish" in section_lower
    has_en = "en)" in section_lower or "english" in section_lower
    
    if not has_pl:
        issues.append("Missing Polish VO/text")
    if not has_en:
        issues.append("Missing English VO/text")
    
    if has_pl and has_en:
        score += 1
    
    # Check length
    word_count = len(section.split())
    if word_count < 150:
        issues.append(f"Section too short ({word_count} words, expected 150+)")
        score -= 1
    
    return {
        "exists": True,
        "score": max(0, score),
        "max_score": len(checks) + 1,
        "word_count": word_count,
        "has_polish": has_pl,
        "has_english": has_en,
        "issues": issues
    }

def check_section_12_quality(content: str) -> Dict[str, any]:
    """Check if section 12 has help system texts."""
    section, _, _ = extract_section_content(content, 12)
    
    if not section:
        return {"exists": False, "score": 0, "issues": ["Section 12 not found"]}
    
    issues = []
    score = 0
    
    # Check for key elements
    checks = {
        "tldr": ["tldr", "summary", "brief"],
        "faq": ["faq", "question", "answer"],
        "checklist": ["checklist", "check"],
        "glossary": ["glossary", "term", "definition"]
    }
    
    section_lower = section.lower()
    
    for check_name, keywords in checks.items():
        found = any(kw in section_lower for kw in keywords)
        if found:
            score += 1
        else:
            issues.append(f"Missing {check_name}")
    
    # Check FAQ count (should have at least 5-8)
    faq_matches = len(re.findall(r"^\d+\.\s+.*\?", section, re.MULTILINE))
    if faq_matches < 5:
        issues.append(f"Too few FAQs ({faq_matches}, expected 5+)")
        score -= 1
    
    # Check length
    word_count = len(section.split())
    if word_count < 300:
        issues.append(f"Section too short ({word_count} words, expected 300+)")
        score -= 1
    
    return {
        "exists": True,
        "score": max(0, score),
        "max_score": len(checks),
        "word_count": word_count,
        "faq_count": faq_matches,
        "issues": issues
    }

def check_file(file_path: Path) -> Dict[str, any]:
    """Check a single file."""
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        return {"error": str(e)}
    
    result = {
        "file": str(file_path.relative_to(BASE_DIR)),
        "section_6": check_section_6_quality(content),
        "section_11": check_section_11_quality(content),
        "section_12": check_section_12_quality(content)
    }
    
    return result

def main():
    """Main function."""
    results = []
    
    for category in CATEGORIES:
        category_dir = BASE_DIR / category
        if not category_dir.exists():
            print(f"Warning: {category_dir} does not exist")
            continue
        
        md_files = sorted(category_dir.glob("*.md"))
        md_files = [f for f in md_files if not f.name.startswith("00-")]
        
        for md_file in md_files:
            result = check_file(md_file)
            results.append(result)
    
    # Print summary
    print("=" * 80)
    print("TOOL DOCUMENTATION QUALITY CHECK")
    print("=" * 80)
    print()
    
    # Group by category
    by_category = {}
    for result in results:
        if "error" in result:
            print(f"ERROR in {result['file']}: {result['error']}")
            continue
        
        category = result["file"].split("/")[0]
        if category not in by_category:
            by_category[category] = []
        by_category[category].append(result)
    
    # Print results
    total_files = 0
    total_issues = 0
    
    for category in CATEGORIES:
        if category not in by_category:
            continue
        
        print(f"\n{category.upper()}")
        print("-" * 80)
        
        category_results = by_category[category]
        total_files += len(category_results)
        
        for result in category_results:
            file_name = result["file"].split("/")[-1]
            
            s6 = result["section_6"]
            s11 = result["section_11"]
            s12 = result["section_12"]
            
            issues = []
            
            if not s6.get("exists"):
                issues.append("❌ Section 6 missing")
            elif s6.get("score", 0) < s6.get("max_score", 6) * 0.7:
                issues.append(f"⚠️  Section 6 incomplete (score: {s6.get('score')}/{s6.get('max_score')})")
                issues.extend([f"   - {i}" for i in s6.get("issues", [])])
            
            if not s11.get("exists"):
                issues.append("❌ Section 11 missing")
            elif s11.get("score", 0) < s11.get("max_score", 7) * 0.7:
                issues.append(f"⚠️  Section 11 incomplete (score: {s11.get('score')}/{s11.get('max_score')})")
                if not s11.get("has_polish"):
                    issues.append("   - Missing Polish VO/text")
                if not s11.get("has_english"):
                    issues.append("   - Missing English VO/text")
                issues.extend([f"   - {i}" for i in s11.get("issues", []) if "Missing" in i])
            
            if not s12.get("exists"):
                issues.append("❌ Section 12 missing")
            elif s12.get("score", 0) < s12.get("max_score", 4) * 0.7:
                issues.append(f"⚠️  Section 12 incomplete (score: {s12.get('score')}/{s12.get('max_score')})")
                issues.extend([f"   - {i}" for i in s12.get("issues", [])])
            
            if issues:
                print(f"\n{file_name}:")
                for issue in issues:
                    print(f"  {issue}")
                total_issues += len([i for i in issues if "❌" in i or "⚠️" in i])
            else:
                print(f"✓ {file_name}")
    
    print("\n" + "=" * 80)
    print(f"SUMMARY: {total_files} files checked, {total_issues} files with issues")
    print("=" * 80)
    
    # Return exit code
    return 0 if total_issues == 0 else 1

if __name__ == "__main__":
    exit(main())
