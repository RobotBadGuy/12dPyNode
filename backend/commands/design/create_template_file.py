from pathlib import Path
from typing import Optional

def create_template(template_name: str, final_cut_slope: str = "2", final_fill_slope: str = "2", final_search_distance: str = "100", output_dir: Optional[str] = None):
    
    # Strip .tpl suffix if present
    if template_name.endswith('.tpl'):
        template_name = template_name[:-4]
    
    # Determine output path
    if output_dir:
        output_path = Path(output_dir) / f'{template_name}.tpl'
    else:
        output_path = Path(f'{template_name}.tpl')
    
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-16') as file:
        file.write(rf"""
          template "{template_name}" {{
            final {{
              "int"
              cut_slope {final_cut_slope} fill_slope {final_fill_slope} search_distance {final_search_distance}
            }}
          }}
        """)