import os
from pypdf import PdfReader

knowledge_dir = 'knowledge'
output_file = os.path.join(knowledge_dir, 'extracted_content.txt')

def extract_text():
    files = sorted([f for f in os.listdir(knowledge_dir) if f.endswith('.pdf')])
    combined_text = ""
    
    print(f"Found {len(files)} PDF files.")
    
    for filename in files:
        filepath = os.path.join(knowledge_dir, filename)
        print(f"Processing {filename}...")
        try:
            reader = PdfReader(filepath)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            
            combined_text += f"\n\n--- START OF FILE: {filename} ---\n\n"
            combined_text += text
            combined_text += f"\n\n--- END OF FILE: {filename} ---\n\n"
            
        except Exception as e:
            print(f"Error processing {filename}: {e}")
            
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(combined_text)
        
    print(f"All text extracted to {output_file}")

if __name__ == "__main__":
    extract_text()
