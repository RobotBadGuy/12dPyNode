"""
PyChain Service - Core processing logic extracted from Gradio app
This module provides framework-agnostic functions for chain file generation
"""

import os
import tempfile
import shutil
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from utils.data_loader import load_naming_data
from utils.xml_generator import create_AllChain_file
from commands.importers import (
    generate_ifc_xml_content, 
    generate_dwg_xml_content, 
    generate_dgn_xml_content,
    normalize_file_path
)
from utils.create_attr_manipulator_files import create_attr_manipulator_files
from utils.apply_attr_manipulator_files import generate_apply_attr_xml_content

# Import command components
from commands.metadata import (
    generate_xml_header,
    generate_meta_data_tin,
    generate_meta_data_model,
    generate_chain_wrapper,
    generate_chain_settings,
    generate_chain_closing
)
from commands.views import (
    create_view_command,
    add_model_to_view_command,
    remove_model_from_view_command,
    delete_models_from_view_command
)
from commands.models import clean_model_command
from commands.run_options import (
    create_shared_model_command
)
from commands.functions import (
    function_command
)
from commands.conditionals import (
    if_function_exists_command
)
from commands.tin import (
    triangulate_manual_option_command,
    tin_function_command
)
from commands.other import label_command

# normalize_file_path is imported from commands.importers and re-exported for backward compatibility


def process_file_with_custom_path(
    file_path: str,
    actual_file_path: str,
    output_folder: str,
    project_folder: str,
    naming_data,
    model_type: str = "Model"
) -> Optional[str]:
    """
    Process a single file and generate chain file
    
    Args:
        file_path: Temporary uploaded file path
        actual_file_path: Actual file path to use in chain files
        output_folder: Folder to save generated chain files
        project_folder: Project folder path from Excel
        naming_data: DataFrame with naming conventions
        model_type: "Model" for regular models, "TIN" for surface/triangulation models
    
    Returns:
        Path to generated chain file or None if skipped
    """
    if not (file_path.lower().endswith('.dwg') or 
            file_path.lower().endswith('.ifc') or 
            file_path.lower().endswith('.dgn')):
        return None
    
    # Get the filename stem from the actual path (not temp path)
    filename_stem = os.path.splitext(os.path.basename(actual_file_path))[0]
    
    # Check if filename_stem exists in naming_data
    if filename_stem not in naming_data['filename'].values:
        print(f"Filename '{filename_stem}' not found in naming data. Skipping.")
        return None

    # Get the row for this filename
    row = naming_data[naming_data['filename'] == filename_stem].iloc[0]
    discipline = row['discipline']
    prefix = row['prefix'] 
    description = row['description']
    object_dimension = str(row['object_dimension'])
    file_ext = str(row['file_ext'])

    # Create variables
    variable = filename_stem
    options_ext = ''
    surface_value = description
    modified_variable = variable.replace('-', ' ')

    if '-00-' in variable:
        options_ext = ''
    elif '-01-' in variable:
        options_ext = 'Opt 01'
    elif '-02-' in variable:
        options_ext = 'Opt 02'
    elif '-03-' in variable:
        options_ext = 'Opt 03'
    elif '-04-' in variable:
        options_ext = 'Opt 04'
    elif '-05-' in variable:
        options_ext = 'Opt 05'

    # Generate XML directly as text (not using Word Document)
    xml_content = []
    
    # Use model_type parameter instead of checking filename pattern
    if model_type == "TIN":
        # TIN processing - Generate XML for triangulation files
        xml_content.extend(generate_xml_header(date="2024-01-16", time="20:57:27"))
        xml_content.extend(generate_meta_data_tin(project_folder, variable))
        xml_content.extend(generate_chain_wrapper())
        xml_content.extend(generate_chain_settings())
        
        # View commands
        xml_content.extend(create_view_command(modified_variable, coordinates=(130, 120, 640, 790)))
        xml_content.extend(remove_model_from_view_command("*", modified_variable))
        xml_content.extend(add_model_to_view_command(modified_variable))
        xml_content.extend(remove_model_from_view_command("*tin", modified_variable))
        xml_content.extend(delete_models_from_view_command(modified_variable, coordinates=(241, 386), continue_on_failure=False))

        # File import section - use dedicated functions for each file type
        if actual_file_path.lower().endswith('.ifc'):
            xml_content.extend(generate_ifc_xml_content(actual_file_path, modified_variable))
        elif actual_file_path.lower().endswith('.dwg'):
            xml_content.extend(generate_dwg_xml_content(actual_file_path, modified_variable))
        elif actual_file_path.lower().endswith('.dgn'):
            xml_content.extend(generate_dgn_xml_content(actual_file_path, modified_variable))
            # Ensure 12d attribute manipulator files exist for DGN imports
            try:
                if project_folder:
                    create_attr_manipulator_files(project_folder)
            except Exception as _e:
                # Non-fatal: continue even if these could not be written
                print(f"Warning: failed to create attr manipulator files in '{project_folder}': {_e}")

        # Add model to view section (must come before applying attribute manipulators)
        xml_content.extend(add_model_to_view_command(modified_variable))

        # Now append Apply Attribute Manipulator steps for DGN files
        if actual_file_path.lower().endswith('.dgn'):
            try:
                xml_content.extend(generate_apply_attr_xml_content(modified_variable))
            except Exception as _e:
                print(f"Warning: failed to append attribute manipulator steps for '{modified_variable}': {_e}")
        
        # TIN function commands
        xml_content.extend(if_function_exists_command(modified_variable, f"{modified_variable} tin"))
        xml_content.extend(triangulate_manual_option_command(modified_variable, prefix, surface_value, file_ext, options_ext, discipline))
        xml_content.extend(tin_function_command(modified_variable))
        
        # Close TIN chain
        xml_content.extend(generate_chain_closing())

    else:
        # Standard processing - Generate proper XML structure
        xml_content.extend(generate_xml_header(date="2023-10-13", time="08:35:06"))
        xml_content.extend(generate_meta_data_model(project_folder, variable))
        xml_content.extend(generate_chain_wrapper())
        xml_content.extend(generate_chain_settings())
        
        # Clean model command
        xml_content.extend(clean_model_command(discipline, prefix, description, object_dimension, file_ext, variable))
        
        # View commands
        xml_content.extend(create_view_command(modified_variable, coordinates=(40, 30, 565, 715)))
        xml_content.extend(remove_model_from_view_command("*", modified_variable))
        xml_content.extend(add_model_to_view_command(modified_variable))
        xml_content.extend(delete_models_from_view_command(modified_variable, coordinates=(497, 319), continue_on_failure=True))

        # File import section based on file type
        if actual_file_path.lower().endswith('.ifc'):
            xml_content.extend(generate_ifc_xml_content(actual_file_path, modified_variable))
        elif actual_file_path.lower().endswith('.dwg'):
            xml_content.extend(generate_dwg_xml_content(actual_file_path, modified_variable))
        elif actual_file_path.lower().endswith('.dgn'):
            xml_content.extend(generate_dgn_xml_content(actual_file_path, modified_variable))
            # Ensure 12d attribute manipulator files exist for DGN imports
            try:
                if project_folder:
                    create_attr_manipulator_files(project_folder)
            except Exception as _e:
                print(f"Warning: failed to create attr manipulator files in '{project_folder}': {_e}")

        # Add model back to view (must come before applying attribute manipulators)
        xml_content.extend(add_model_to_view_command(modified_variable))

        # Now append Apply Attribute Manipulator steps for DGN files
        if actual_file_path.lower().endswith('.dgn'):
            try:
                xml_content.extend(generate_apply_attr_xml_content(modified_variable))
            except Exception as _e:
                print(f"Warning: failed to append attribute manipulator steps for '{modified_variable}': {_e}")
        
        # Remove various model types from view
        xml_content.extend(remove_model_from_view_command("*tm", modified_variable))
        xml_content.extend(remove_model_from_view_command("*tin", modified_variable))
        xml_content.extend(remove_model_from_view_command("*Label", modified_variable))
        xml_content.extend(remove_model_from_view_command("*Mark", modified_variable))
        
        # Shared model creation
        xml_content.extend(create_shared_model_command(discipline, prefix, description, object_dimension, file_ext, variable, modified_variable))
        
        # Close Model chain
        xml_content.extend(generate_chain_closing())

    # Save the file directly as proper XML in the web-app output folder
    output_file = os.path.join(output_folder, f'{variable}.chain')
    
    # Remove existing file if it exists
    if os.path.exists(output_file):
        os.remove(output_file)
        print(f"Replaced existing file: {variable}.chain")
    
    with open(output_file, 'w', encoding='utf-8') as file:
        file.write('\n'.join(xml_content))

    # Also copy the chain file into the 12d project folder (same location as attribute files)
    if project_folder:
        try:
            os.makedirs(project_folder, exist_ok=True)
            dest_path = os.path.join(project_folder, f'{variable}.chain')
            shutil.copy2(output_file, dest_path)
        except Exception as _e:
            # Non-fatal: continue even if we couldn't copy the file
            print(f"Warning: failed to copy chain file to project folder '{project_folder}': {_e}")

    return output_file


def process_files_batch(
    excel_file_path: str,
    file_paths: List[Tuple[str, str]],  # List of (temp_path, actual_path) tuples
    model_type_map: Dict[str, str],  # Map filename -> model_type
    output_folder: str
) -> Tuple[List[str], Optional[str], List[Dict[str, str]]]:
    """
    Process multiple files and generate chain files
    
    Args:
        excel_file_path: Path to the Excel naming convention file
        file_paths: List of tuples (temp_file_path, actual_file_path)
        model_type_map: Dictionary mapping filename -> model_type ("Model" or "TIN")
        output_folder: Folder to save generated chain files
    
    Returns:
        Tuple of (list of generated chain file paths, project_folder_path)
    """
    # Load naming data
    naming_data = load_naming_data(excel_file_path)
    if naming_data is None:
        raise ValueError("Error loading naming data from Excel file")
    
    generated_files_paths: List[str] = []
    # Track per-file metadata for the frontend
    file_details: List[Dict[str, str]] = []
    # Track the first non-empty project folder for summary purposes
    first_project_folder: Optional[str] = None
    
    # Process each file
    for temp_path, actual_path in file_paths:
        filename = os.path.basename(actual_path)
        filename_stem = os.path.splitext(filename)[0]
        
        if filename_stem not in naming_data['filename'].values:
            print(f"Skipping {filename} as it's not in the naming convention file.")
            continue
        
        row = naming_data[naming_data['filename'] == filename_stem].iloc[0]
        row_project_folder = normalize_file_path(row.get('project_folder_path', ''))

        # Remember the first non-empty project folder for summary / fallback
        if first_project_folder is None and row_project_folder:
            first_project_folder = row_project_folder
        
        # Get model type for this file
        selected_model_type = model_type_map.get(filename) or model_type_map.get(filename_stem) or "Model"
        
        generated_file = process_file_with_custom_path(
            temp_path,
            actual_path,
            output_folder,
            row_project_folder or '',
            naming_data,
            selected_model_type
        )
        if generated_file:
            generated_files_paths.append(generated_file)
            file_details.append(
                {
                    "filename": os.path.basename(generated_file),
                    "output_path": generated_file,
                    "project_folder": row_project_folder or "",
                }
            )
    
    # Create one ALL CHAIN file per project_folder and include them in the results
    if generated_files_paths:
        # Group generated files by their project_folder
        files_by_project: Dict[str, List[str]] = {}
        for path, detail in zip(generated_files_paths, file_details):
            project = detail.get("project_folder") or ""
            if not project:
                # Skip files without a project folder for per-project ALL CHAIN
                continue
            files_by_project.setdefault(project, []).append(path)

        # Create an ALL CHAIN file for each project folder
        for project_folder, paths in files_by_project.items():
            if not paths:
                continue
            all_chain_path = create_AllChain_file(output_folder, paths, project_folder)
            if all_chain_path:
                generated_files_paths.append(all_chain_path)
                file_details.append(
                    {
                        "filename": os.path.basename(all_chain_path),
                        "output_path": all_chain_path,
                        "project_folder": project_folder,
                    }
                )
    
    return generated_files_paths, first_project_folder, file_details

