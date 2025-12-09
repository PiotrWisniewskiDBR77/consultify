import re
import json

def parse_drd_content(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    axes = {}
    
    # Split by Axis is hard because they are scattered in files.
    # But we have "Area XY" which is unique.
    
    # We'll treat the whole text as a stream.
    # Regex for Area header: r"Area (\d)([A-Z])\.\s*(.*)"
    
    area_pattern = re.compile(r"Area (\d)([A-Z])\.\s*(.*)")
    level_pattern = re.compile(r"Level\s*(\d+)\s*\.\s*(.*)")
    
    # Find all start indices of Areas
    area_matches = list(area_pattern.finditer(content))
    
    drd_data = []
    
    for i, match in enumerate(area_matches):
        axis_num = int(match.group(1))
        area_letter = match.group(2)
        area_name = match.group(3).strip()
        
        start_index = match.end()
        end_index = area_matches[i+1].start() if i + 1 < len(area_matches) else len(content)
        
        area_text = content[start_index:end_index]
        
        # Parse Levels within this area text
        levels = []
        level_matches = list(level_pattern.finditer(area_text))
        
        for j, l_match in enumerate(level_matches):
            lvl_num = int(l_match.group(1))
            lvl_title = l_match.group(2).strip()
            
            l_start = l_match.end()
            l_end = level_matches[j+1].start() if j + 1 < len(level_matches) else len(area_text)
            
            lvl_desc = area_text[l_start:l_end].replace('\n', ' ').strip()
            # Clean up hyphenation or extra spaces
            lvl_desc = re.sub(r'\s+', ' ', lvl_desc)
            
            levels.append({
                "level": lvl_num,
                "title": lvl_title,
                "description": lvl_desc
            })
            
        # Add to structure
        # Check if Axis exists in our list
        axis_entry = next((x for x in drd_data if x["id"] == axis_num), None)
        if not axis_entry:
            axis_entry = {
                "id": axis_num,
                "name": f"Axis {axis_num}", # Placeholder name, can't easily parse from stream mixed with other text
                "areas": []
            }
            drd_data.append(axis_entry)
            
        axis_entry["areas"].append({
            "id": f"{axis_num}{area_letter}",
            "name": area_name,
            "levels": levels
        })

    return drd_data

if __name__ == "__main__":
    data = parse_drd_content("/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/knowledge/extracted_content.txt")
    
    # We need to manually add Axis Names based on knowledge since they appear earlier in text
    axis_names = {
        1: "Digital Processes",
        2: "Digital Products",
        3: "Digital Business Models",
        4: "Data Management",
        5: "Digital Culture",
        6: "Cybersecurity",
        7: "Artificial Intelligence"
    }
    
    for axis in data:
        if axis["id"] in axis_names:
            axis["name"] = axis_names[axis["id"]]
            
    print(json.dumps(data, indent=2))
