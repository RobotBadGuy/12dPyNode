def create_mtf_file(template_left_name: str, template_right_name: str) -> str:
    """
    Generate MTF file content as a string
    
    Args:
        template_left_name: Name of the left template
        template_right_name: Name of the right template
    
    Returns:
        MTF file content as a string
    """
    return rf"""left_side = {{
  
}}

right_side = {{

}}

specials = {{

}}

hinge_modifier = {{

}}

left_side_modifier = {{
  insert_full_template start_ref 0 final_ref 0 "{template_right_name}" "Design<<" absolute extra_start extra_end
}}

right_side_modifier = {{
  insert_full_template start_ref 0 final_ref 0 "{template_left_name}" "Design<<" absolute extra_start extra_end
}}

stripping = {{

}}

boxing_file = ""

left_boxing = {{

}}

right_boxing = {{

}}

left_boxing_2 = {{

}}

right_boxing_2 = {{

}}

left_boxing_3 = {{

}}

right_boxing_3 = {{

}}

left_boxing_4 = {{

}}

right_boxing_4 = {{

}}

left_boxing_5 = {{

}}

right_boxing_5 = {{

}}

left_boxing_6 = {{

}}

right_boxing_6 = {{

}}

left_boxing_7 = {{

}}

right_boxing_7 = {{

}}

left_boxing_8 = {{

}}

right_boxing_8 = {{

}}

string_modifiers = {{

}}

section_width =     10000.00000

auto_super_tables = 1

loop_removals = {{

}}

auto_recalc = 0

hinge_link_name = "HINGE"

hinge_widen_type = "horz"

extra_start_end_value = 0.00010

default_chainage_type = "Extents reference string"

design_layer_name = "Design"

show_extra_start_end = 1

show_absolute_column = 1

show_interval_column = 1

show_extra_start_end_column = 1

shape_formation_type = "full"

check_volume_errors = 1

minimum_final_batter_length = 0.00000

allow_links_modified_inwards = 0

do_clear_output_window = 0
"""


def write_mtf_file(mtf_name: str, template_left_name: str, template_right_name: str, output_path: str) -> str:
    """
    Write an MTF file to the specified output path
    
    Args:
        mtf_name: Name of the MTF file (without .mtf extension)
        template_left_name: Name of the left template
        template_right_name: Name of the right template
        output_path: Directory where the MTF file should be written
    
    Returns:
        Full path to the created MTF file
    """
    from pathlib import Path
    
    output_dir = Path(output_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    mtf_file_path = output_dir / f"{mtf_name}.mtf"
    content = create_mtf_file(template_left_name, template_right_name)
    
    with open(mtf_file_path, 'w') as file:
        file.write(content)
    
    return str(mtf_file_path)
