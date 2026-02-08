#!/usr/bin/env python3
"""
Generate detailed QA report showing exactly what needs to be fixed in each file.
"""

import json
import sys
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

from qa_tools_docs_completeness import check_file, CATEGORIES, BASE_DIR

def main():
    """Generate detailed report."""
    results = []
    
    for category in CATEGORIES:
        category_dir = BASE_DIR / category
        if not category_dir.exists():
            continue
        
        md_files = sorted(category_dir.glob("*.md"))
        md_files = [f for f in md_files if not f.name.startswith("00-")]
        
        for md_file in md_files:
            result = check_file(md_file)
            if "error" not in result:
                results.append(result)
    
    # Generate report
    report = {
        "summary": {
            "total_files": len(results),
            "files_with_issues": 0,
            "section_6_issues": 0,
            "section_11_issues": 0,
            "section_12_issues": 0
        },
        "files": []
    }
    
    for result in results:
        file_info = {
            "file": result["file"],
            "issues": []
        }
        
        s6 = result["section_6"]
        s11 = result["section_11"]
        s12 = result["section_12"]
        
        has_issues = False
        
        if not s6.get("exists") or s6.get("score", 0) < s6.get("max_score", 6) * 0.7:
            file_info["issues"].append({
                "section": 6,
                "severity": "critical" if not s6.get("exists") else "warning",
                "details": s6.get("issues", [])
            })
            has_issues = True
            report["summary"]["section_6_issues"] += 1
        
        if not s11.get("exists") or s11.get("score", 0) < s11.get("max_score", 7) * 0.7:
            file_info["issues"].append({
                "section": 11,
                "severity": "critical" if not s11.get("exists") else "warning",
                "details": s11.get("issues", []),
                "missing_polish": not s11.get("has_polish", False),
                "missing_english": not s11.get("has_english", False)
            })
            has_issues = True
            report["summary"]["section_11_issues"] += 1
        
        if not s12.get("exists") or s12.get("score", 0) < s12.get("max_score", 4) * 0.7:
            file_info["issues"].append({
                "section": 12,
                "severity": "critical" if not s12.get("exists") else "warning",
                "details": s12.get("issues", []),
                "faq_count": s12.get("faq_count", 0)
            })
            has_issues = True
            report["summary"]["section_12_issues"] += 1
        
        if has_issues:
            report["files"].append(file_info)
            report["summary"]["files_with_issues"] += 1
    
    # Save report
    report_path = Path("_analysis/tools_docs_qa_report.json")
    report_path.parent.mkdir(exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    
    print(f"Report saved to {report_path}")
    print(f"\nSummary:")
    print(f"  Total files: {report['summary']['total_files']}")
    print(f"  Files with issues: {report['summary']['files_with_issues']}")
    print(f"  Section 6 issues: {report['summary']['section_6_issues']}")
    print(f"  Section 11 issues: {report['summary']['section_11_issues']}")
    print(f"  Section 12 issues: {report['summary']['section_12_issues']}")
    
    return report

if __name__ == "__main__":
    main()
