"""
Workflow Runner - Executes node-based workflow graphs to generate chain files
"""

import os
import json
import re
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from datetime import datetime
import pandas as pd
from utils.data_loader import load_naming_data

# Import command generators
from commands.metadata import (
    generate_xml_header,
    generate_meta_data_tin,
    generate_meta_data_model,
    generate_chain_wrapper,
    generate_chain_settings,
    generate_chain_closing,
)
from commands.views import (
    create_view_command,
    add_model_to_view_command,
    remove_model_from_view_command,
)
from commands.models import clean_model_command, rename_model_command
from commands.run_options import (
    create_shared_model_command,
)
from commands.views import (
    delete_models_from_view_command,
)
from commands.conditionals import if_function_exists_command
from commands.tin import (
    triangulate_manual_option_command,
    tin_function_command,
    create_contour_smooth_label_command,
    drape_strings_to_tin_command,
    run_or_create_contours_command,
)
from commands.importers import (
    generate_ifc_xml_content,
    generate_dwg_xml_content,
    generate_dgn_xml_content,
)
from commands.quantities import (
    get_total_surface_area_command,
    trimesh_volume_report_command,
    volume_tin_to_tin_command,
)
from commands.strings import convert_lines_to_variable_command
from commands.trimesh import create_trimesh_from_tin_command
from commands.conditionals import add_comment_command, add_label_command
from commands.design.create_apply_mtf import create_apply_mtf
from commands.design import apply_mtf_command
from commands.design.create_mtf_file import create_mtf_file
from commands.design.create_template_file import create_template
from commands.functions import function_command


def resolve_variable(
    var_name: str,
    model_name: str,
    variables: List[Dict[str, Any]],
    per_run_vars: Dict[str, Any],
    _visited: Optional[set] = None,
) -> str:
    """
    Resolve a variable reference to its actual value
    
    Supports two modes:
    1. Direct variable name: if var_name exactly matches a variable, return its value
    2. Template substitution: if var_name contains {token} patterns, substitute them
    
    Args:
        var_name: Variable name to resolve, or string containing {token} patterns
        model_name: Current model name (for per-model variables)
        variables: List of variable bindings
        per_run_vars: Per-run variable values
        _visited: Internal set to prevent infinite recursion (do not pass manually)
    
    Returns:
        Resolved variable value as string
    """
    if _visited is None:
        _visited = set()
    
    # Prevent infinite recursion
    if var_name in _visited:
        return var_name
    _visited.add(var_name)
    
    # Helper function to resolve a single token (without braces)
    def resolve_token(token: str) -> str:
        """Resolve a single variable token to its value"""
        # Check per-run variables first
        if token in per_run_vars:
            return str(per_run_vars[token])
        
        # Check variable bindings
        for var in variables:
            var_name_in_list = var.get('name', '')
            if var_name_in_list == token:
                value = var.get('value', '')
                # If it's a per-model variable and contains {model_name}, substitute
                if var.get('scope') == 'per-model' and isinstance(value, str):
                    # Recursively resolve {model_name} in the value
                    return resolve_variable(value, model_name, variables, per_run_vars, _visited.copy())
                return str(value)
        
        # Built-in variables
        if token == 'model_name':
            return model_name
        if token == 'modified_variable':
            return model_name.replace('-', ' ')
        if token == 'variable':
            return model_name
        
        # Unknown token - return as-is (will remain in braces)
        return None
    
    # Check if string contains template tokens {token}
    if '{' in var_name and '}' in var_name:
        # Template substitution mode
        # Pattern matches {token} where token doesn't contain braces
        pattern = r'\{([^{}]+)\}'
        result = var_name
        # Find all matches and collect replacements
        matches = list(re.finditer(pattern, var_name))
        
        # Replace from end to start to preserve positions
        for match in reversed(matches):
            token = match.group(1)
            resolved = resolve_token(token)
            if resolved is not None:
                # Replace this specific occurrence
                start, end = match.span()
                result = result[:start] + resolved + result[end:]
            # If resolved is None, leave {token} as-is (unknown variable)
        
        return result
    
    # Direct variable name mode (backward compatibility)
    # Check per-run variables first
    if var_name in per_run_vars:
        return str(per_run_vars[var_name])
    
    # Check variable bindings
    for var in variables:
        var_name_in_list = var.get('name', '')
        if var_name_in_list == var_name:
            value = var.get('value', '')
            # If it's a per-model variable and contains {model_name}, substitute
            if var.get('scope') == 'per-model' and isinstance(value, str):
                return resolve_variable(value, model_name, variables, per_run_vars, _visited.copy())
            return str(value)
    
    # Default transformations
    if var_name == 'model_name':
        return model_name
    if var_name == 'modified_variable':
        return model_name.replace('-', ' ')
    if var_name == 'variable':
        return model_name
    
    # Return as-is if not found (might be a literal)
    return var_name


def execute_node(
    node: Dict[str, Any],
    model_name: str,
    variables: List[Dict[str, Any]],
    per_run_vars: Dict[str, Any],
    xml_content: List[str],
    output_folder: str = '',
) -> None:
    """
    Execute a single node and append XML commands to xml_content
    
    Args:
        node: Node definition from graph
        model_name: Current model name
        variables: Variable bindings
        per_run_vars: Per-run variable values
        xml_content: List to append XML lines to
    """
    node_type = node.get('type')
    data = node.get('data', {})
    
    if node_type == 'import':
        file_type = data.get('fileType', 'dwg')
        actual_file_path = resolve_variable(
            data.get('actualFilePath', 'actual_file_path'),
            model_name,
            variables,
            per_run_vars,
        )
        modified_variable = resolve_variable('modified_variable', model_name, variables, per_run_vars)
        
        if file_type == 'ifc':
            xml_content.extend(generate_ifc_xml_content(actual_file_path, modified_variable))
        elif file_type == 'dwg':
            xml_content.extend(generate_dwg_xml_content(actual_file_path, modified_variable))
        elif file_type == 'dgn':
            xml_content.extend(generate_dgn_xml_content(actual_file_path, modified_variable))
    
    elif node_type == 'cleanModel':
        discipline = resolve_variable(data.get('discipline', 'discipline'), model_name, variables, per_run_vars)
        prefix = resolve_variable(data.get('prefix', 'prefix'), model_name, variables, per_run_vars)
        description = resolve_variable(data.get('description', 'description'), model_name, variables, per_run_vars)
        object_dimension = resolve_variable(data.get('objectDimension', 'object_dimension'), model_name, variables, per_run_vars)
        file_ext = resolve_variable(data.get('fileExt', 'file_ext'), model_name, variables, per_run_vars)
        variable = resolve_variable(data.get('variable', 'variable'), model_name, variables, per_run_vars)
        
        xml_content.extend(clean_model_command(discipline, prefix, description, object_dimension, file_ext, variable))
    
    elif node_type == 'createView':
        view_name = resolve_variable(data.get('modifiedVariable', 'modified_variable'), model_name, variables, per_run_vars)
        coordinates = data.get('coordinates', [40, 30, 565, 715])
        xml_content.extend(create_view_command(view_name, coordinates=tuple(coordinates)))
    
    elif node_type == 'addModelToView':
        model_name = resolve_variable(data.get('modelName', 'model_name'), model_name, variables, per_run_vars)
        view_name = resolve_variable(data.get('viewName', 'view_name'), model_name, variables, per_run_vars)
        xml_content.extend(add_model_to_view_command(model_name))
    
    elif node_type == 'removeModelFromView':
        pattern = data.get('pattern', '*')
        modified_variable = resolve_variable(data.get('modifiedVariable', 'modified_variable'), model_name, variables, per_run_vars)
        xml_content.extend(remove_model_from_view_command(pattern, modified_variable))
    
    elif node_type == 'deleteModelsFromView':
        modified_variable = resolve_variable(data.get('modifiedVariable', 'modified_variable'), model_name, variables, per_run_vars)
        coordinates = data.get('coordinates', [497, 319])
        continue_on_failure = data.get('continueOnFailure', True)
        xml_content.extend(delete_models_from_view_command(modified_variable, coordinates=tuple(coordinates), continue_on_failure=continue_on_failure))
    
    elif node_type == 'createSharedModel':
        discipline = resolve_variable(data.get('discipline', 'discipline'), model_name, variables, per_run_vars)
        prefix = resolve_variable(data.get('prefix', 'prefix'), model_name, variables, per_run_vars)
        description = resolve_variable(data.get('description', 'description'), model_name, variables, per_run_vars)
        object_dimension = resolve_variable(data.get('objectDimension', 'object_dimension'), model_name, variables, per_run_vars)
        file_ext = resolve_variable(data.get('fileExt', 'file_ext'), model_name, variables, per_run_vars)
        variable = resolve_variable(data.get('variable', 'variable'), model_name, variables, per_run_vars)
        modified_variable = resolve_variable(data.get('modifiedVariable', 'modified_variable'), model_name, variables, per_run_vars)
        
        xml_content.extend(create_shared_model_command(discipline, prefix, description, object_dimension, file_ext, variable, modified_variable))
    
    elif node_type == 'triangulateManualOption':
        modified_variable = resolve_variable(data.get('modifiedVariable', 'modified_variable'), model_name, variables, per_run_vars)
        prefix = resolve_variable(data.get('prefix', 'prefix'), model_name, variables, per_run_vars)
        surface_value = resolve_variable(data.get('surfaceValue', 'surface_value'), model_name, variables, per_run_vars)
        file_ext = resolve_variable(data.get('fileExt', 'file_ext'), model_name, variables, per_run_vars)
        options_ext = resolve_variable(data.get('optionsExt', 'options_ext'), model_name, variables, per_run_vars)
        discipline = resolve_variable(data.get('discipline', 'discipline'), model_name, variables, per_run_vars)
        
        xml_content.extend(triangulate_manual_option_command(modified_variable, prefix, surface_value, file_ext, options_ext, discipline))
    
    elif node_type == 'tinFunction':
        modified_variable = resolve_variable(data.get('modifiedVariable', 'modified_variable'), model_name, variables, per_run_vars)
        xml_content.extend(tin_function_command(modified_variable))

    elif node_type == 'runFunction':
        command_name = resolve_variable(data.get('commandName', 'command_name'), model_name, variables, per_run_vars)
        function_name = resolve_variable(data.get('functionName', 'function_name'), model_name, variables, per_run_vars)
        xml_content.extend(function_command(command_name, function_name))
    
    elif node_type == 'ifFunctionExists':
        function_name = resolve_variable(data.get('functionName', 'function_name'), model_name, variables, per_run_vars)
        pass_action_go_to_label = resolve_variable(data.get('passActionGoToLabel', 'pass_action_go_to_label'), model_name, variables, per_run_vars)
        fail_action_go_to_label = resolve_variable(data.get('failActionGoToLabel', 'fail_action_go_to_label'), model_name, variables, per_run_vars)
        xml_content.extend(if_function_exists_command(function_name, pass_action_go_to_label, fail_action_go_to_label))
    
    elif node_type == 'renameModel':
        pattern_replace_token = data.get('patternReplace', 'pattern_replace')
        pattern_search_token = data.get('patternSearch', 'pattern_search')
        pattern_replace = resolve_variable(pattern_replace_token, model_name, variables, per_run_vars)
        pattern_search = resolve_variable(pattern_search_token, model_name, variables, per_run_vars)
        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"RenameModel: patternSearch token='{pattern_search_token}', resolved='{pattern_search}', variables={[v.get('name') for v in variables]}, per_run_vars={list(per_run_vars.keys())}")
        xml_content.extend(rename_model_command(pattern_replace, pattern_search))
    
    elif node_type == 'getTotalSurfaceArea':
        export_location = resolve_variable(data.get('exportLocation', 'export_location'), model_name, variables, per_run_vars)
        tin_name = resolve_variable(data.get('tinName', 'tin_name'), model_name, variables, per_run_vars)
        polygon_name = resolve_variable(data.get('polygonName', 'polygon_name'), model_name, variables, per_run_vars)
        xml_content.extend(get_total_surface_area_command(export_location, tin_name, polygon_name))
    
    elif node_type == 'trimeshVolumeReport':
        trimesh_name = resolve_variable(data.get('trimeshName', 'trimesh_name'), model_name, variables, per_run_vars)
        output_location = resolve_variable(data.get('outputLocation', 'output_location'), model_name, variables, per_run_vars)
        filename = resolve_variable(data.get('filename', 'filename'), model_name, variables, per_run_vars)
        xml_content.extend(trimesh_volume_report_command(trimesh_name, output_location, filename))
    
    elif node_type == 'volumeTinToTin':
        original_tin_name = resolve_variable(data.get('originalTinName', 'original_tin_name'), model_name, variables, per_run_vars)
        new_tin_name = resolve_variable(data.get('newTinName', 'new_tin_name'), model_name, variables, per_run_vars)
        output_location = resolve_variable(data.get('outputLocation', 'output_location'), model_name, variables, per_run_vars)
        filename = resolve_variable(data.get('filename', 'filename'), model_name, variables, per_run_vars)
        xml_content.extend(volume_tin_to_tin_command(original_tin_name, new_tin_name, output_location, filename))
    
    elif node_type == 'convertLinesToVariable':
        xml_content.extend(convert_lines_to_variable_command(model_name))
    
    elif node_type == 'createContourSmoothLabel':
        prefix = resolve_variable(data.get('prefix', 'prefix'), model_name, variables, per_run_vars)
        cell_value = resolve_variable(data.get('cellValue', 'cell_value'), model_name, variables, per_run_vars)
        xml_content.extend(create_contour_smooth_label_command(prefix, cell_value))
    
    elif node_type == 'drapeToTin':
        data_to_drape = resolve_variable(data.get('dataToDrape', 'data_to_drape'), model_name, variables, per_run_vars)
        z_offset = resolve_variable(data.get('zOffset', '0'), model_name, variables, per_run_vars)
        tin_name = resolve_variable(data.get('tinName', 'tin_name'), model_name, variables, per_run_vars)
        xml_content.extend(drape_strings_to_tin_command(data_to_drape, z_offset, tin_name))
    
    elif node_type == 'runOrCreateContours':
        prefix = resolve_variable(data.get('prefix', 'prefix'), model_name, variables, per_run_vars)
        cell_value = resolve_variable(data.get('cellValue', 'cell_value'), model_name, variables, per_run_vars)
        xml_content.extend(run_or_create_contours_command(prefix, cell_value))
    
    elif node_type == 'createTrimeshFromTin':
        prefix = resolve_variable(data.get('prefix', 'prefix'), model_name, variables, per_run_vars)
        cell_value = resolve_variable(data.get('cellValue', 'cell_value'), model_name, variables, per_run_vars)
        trimesh_name = resolve_variable(data.get('trimeshName', 'trimesh_name'), model_name, variables, per_run_vars)
        tin_name = resolve_variable(data.get('tinName', 'tin_name'), model_name, variables, per_run_vars)
        z_offset = resolve_variable(data.get('zOffset', '0'), model_name, variables, per_run_vars)
        depth = resolve_variable(data.get('depth', '1'), model_name, variables, per_run_vars)
        colour = resolve_variable(data.get('colour', 'colour'), model_name, variables, per_run_vars)
        xml_content.extend(create_trimesh_from_tin_command(prefix, cell_value, trimesh_name, tin_name, z_offset, depth, colour))
    
    elif node_type == 'addComment':
        comment_name = resolve_variable(data.get('commentName', 'comment_name'), model_name, variables, per_run_vars)
        xml_content.extend(add_comment_command(comment_name))
    
    elif node_type == 'addLabel':
        label_name = resolve_variable(data.get('labelName', 'label_name'), model_name, variables, per_run_vars)
        xml_content.extend(add_label_command(label_name))
    
    elif node_type in ('runOrCreateMtf', 'createApplyMtf'):
        function_name = resolve_variable(
            data.get('functionName', 'function_name'),
            model_name,
            variables,
            per_run_vars,
        )
        mtf_file_name = resolve_variable(
            data.get('mtfFileName', 'mtf_file_name'),
            model_name,
            variables,
            per_run_vars,
        )
        reference_model_name = resolve_variable(
            data.get('referenceModelName', 'reference_model_name'),
            model_name,
            variables,
            per_run_vars,
        )
        volumes_report_name = resolve_variable(
            data.get('volumesReportName', 'volumes_report_name'),
            model_name,
            variables,
            per_run_vars,
        )
        String_Model_Name = resolve_variable(
            data.get('stringModelName', 'string_model_name'),
            model_name,
            variables,
            per_run_vars,
        )
        Section_Model_Name = resolve_variable(
            data.get('sectionModelName', 'section_model_name'),
            model_name,
            variables,
            per_run_vars,
        )
        Road_Tin_Model_Name = resolve_variable(
            data.get('roadTinModelName', 'road_tin_model_name'),
            model_name,
            variables,
            per_run_vars,
        )
        model_for_tin_name = resolve_variable(
            data.get('modelForTinName', 'model_for_tin_name'),
            model_name,
            variables,
            per_run_vars,
        )
        Tadpole_Model_Name = resolve_variable(
            data.get('tadpoleModelName', 'tadpole_model_name'),
            model_name,
            variables,
            per_run_vars,
        )
        Polygon_Model_Name = resolve_variable(
            data.get('polygonModelName', 'polygon_model_name'),
            model_name,
            variables,
            per_run_vars,
        )
        Boundary_Model_Name = resolve_variable(
            data.get('boundaryModelName', 'boundary_model_name'),
            model_name,
            variables,
            per_run_vars,
        )

        xml_content.extend(
            create_apply_mtf(
                function_name,
                mtf_file_name,
                reference_model_name,
                volumes_report_name,
                String_Model_Name,
                Section_Model_Name,
                Road_Tin_Model_Name,
                model_for_tin_name,
                Tadpole_Model_Name,
                Polygon_Model_Name,
                Boundary_Model_Name,
            )
        )
    
    elif node_type == 'applyMtf':
        function_name = resolve_variable(
            data.get('functionName', 'function_name'),
            model_name,
            variables,
            per_run_vars,
        )
        xml_content.extend(apply_mtf_command(function_name))

    elif node_type == 'createMtfFile':
        # Generate an .mtf file as a side-effect; this does not add XML commands.
        mtf_name = resolve_variable(data.get('mtfName', 'mtf_name'), model_name, variables, per_run_vars)
        template_left = resolve_variable(
            data.get('templateLeftName', 'template_left_name'),
            model_name,
            variables,
            per_run_vars,
        )
        template_right = resolve_variable(
            data.get('templateRightName', 'template_right_name'),
            model_name,
            variables,
            per_run_vars,
        )
        try:
            create_mtf_file(mtf_name, template_left, template_right)
        except Exception:
            # Non-fatal: we don't want MTF generation failures to break the chain build
            # Logging can be added here if needed.
            pass
    
    elif node_type == 'createTemplateFile':
        # Generate a .tpl file as a side-effect; this does not add XML commands.
        template_name = resolve_variable(data.get('templateName', 'template_name'), model_name, variables, per_run_vars)
        final_cut_slope = resolve_variable(data.get('finalCutSlope', '2'), model_name, variables, per_run_vars)
        final_fill_slope = resolve_variable(data.get('finalFillSlope', '2'), model_name, variables, per_run_vars)
        final_search_distance = resolve_variable(data.get('finalSearchDistance', '100'), model_name, variables, per_run_vars)
        try:
            create_template(template_name, final_cut_slope, final_fill_slope, final_search_distance, output_dir=output_folder)
        except Exception:
            # Non-fatal: we don't want template generation failures to break the chain build
            # Logging can be added here if needed.
            pass


def build_command_chain(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    model_name: str,
    variables: List[Dict[str, Any]],
    per_run_vars: Dict[str, Any],
    model_type: str = 'Model',
    output_folder: str = '',
) -> List[str]:
    """
    Build the command chain XML for a single model
    
    Args:
        nodes: List of node definitions
        edges: List of edge definitions
        model_name: Current model name
        variables: Variable bindings
        per_run_vars: Per-run variable values
        model_type: 'Model' or 'TIN'
    
    Returns:
        List of XML lines for the command chain
    """
    xml_content: List[str] = []
    
    # Helper: identify flow edges (ignore param: and value: edges)
    def is_flow_edge(edge: Dict[str, Any]) -> bool:
        """Check if an edge is a control-flow edge (not a parameter/data edge)"""
        source_handle = edge.get('sourceHandle', '')
        target_handle = edge.get('targetHandle', '')
        # Flow edges have flow: prefix or no prefix (legacy)
        # Parameter edges have param: prefix, value edges have value: prefix
        if source_handle and not source_handle.startswith('flow:') and ':' in source_handle:
            return False
        if target_handle and not target_handle.startswith('flow:') and ':' in target_handle:
            return False
        return True
    
    # Try the original foreach → chainFileOutput path first (for classic graphs)
    foreach_node = next((n for n in nodes if n.get('type') == 'foreachModel'), None)
    chain_output_nodes = [n for n in nodes if n.get('type') == 'chainFileOutput']
    
    if foreach_node and chain_output_nodes:
        foreach_id = str(foreach_node.get('id'))
        execution_order: List[str] = []
        visited: set[str] = set()

        def find_path(current_id: str, path: List[str]) -> bool:
            """
            Depth-first search from foreach node to chainFileOutput node following
            only flow edges. When we reach the chainFileOutput node, record all
            nodes in the path *before* the chain output as the execution order.
            Returns True if target was found, False otherwise.
            """
            current_id_str = str(current_id)
            
            # Check if we've reached any chainFileOutput node BEFORE checking visited
            for chain_output_node in chain_output_nodes:
                chain_output_id_str = str(chain_output_node.get('id'))
                if current_id_str == chain_output_id_str:
                    # path includes the chain output as the last element; we only want
                    # to execute nodes leading up to it.
                    if path:
                        execution_order.extend(path[:-1])
                    return True

            # Prevent cycles by checking visited AFTER target check
            if current_id_str in visited:
                return False

            visited.add(current_id_str)

            # Find all nodes connected from current (only flow edges)
            for edge in edges:
                if str(edge.get('source')) == current_id_str and is_flow_edge(edge):
                    target_id = edge.get('target')
                    if target_id:
                        if find_path(str(target_id), path + [str(target_id)]):
                            return True

            return False

        # Start from foreach and search for a path to any chainFileOutput
        if foreach_id:
            found = find_path(foreach_id, [foreach_id])
            if not found:
                # Log warning if no path found (but don't fail - fall through to topological sort)
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"No path found from foreachModel node {foreach_id} to any chainFileOutput node. Falling back to topological sort.")
            else:
                # Execute nodes in the discovered order
                # Filter out control-flow nodes that don't generate commands
                control_flow_types = {'foreachModel', 'chainFileOutput', 'excelModels', 'setVariable'}
                for node_id in execution_order:
                    node = next((n for n in nodes if str(n.get('id')) == str(node_id)), None)
                    if node:
                        node_type = node.get('type')
                        # Only execute nodes that generate commands (skip control-flow nodes)
                        if node_type not in control_flow_types:
                            execute_node(node, model_name, variables, per_run_vars, xml_content, output_folder)
                
                # If we found a path and executed nodes, return the XML content
                if execution_order:
                    return xml_content
    
    # Fallback: no foreach node – build a generic topological order using flow edges only
    # This allows workflows that don't use the Foreach Model node.
    node_ids = [str(n.get('id')) for n in nodes if n.get('id') is not None]
    id_to_node: Dict[str, Dict[str, Any]] = {str(n.get('id')): n for n in nodes if n.get('id') is not None}
    
    # Initialize graph structures
    indegree: Dict[str, int] = {node_id: 0 for node_id in node_ids}
    adjacency: Dict[str, List[str]] = {node_id: [] for node_id in node_ids}
    
    # Build adjacency and indegree from flow edges
    # Only include edges where both source and target nodes exist
    import logging
    logger = logging.getLogger(__name__)
    for edge in edges:
        if not is_flow_edge(edge):
            continue
        source_id = str(edge.get('source'))
        target_id = str(edge.get('target'))
        # Only add edge if both nodes exist in our node set
        if source_id in adjacency and target_id in adjacency:
            adjacency[source_id].append(target_id)
            indegree[target_id] += 1
        else:
            # Log warning if edge references non-existent node (helps debug paste issues)
            if source_id not in adjacency:
                logger.warning(f"Edge references non-existent source node: {source_id}")
            if target_id not in adjacency:
                logger.warning(f"Edge references non-existent target node: {target_id}")
    
    # Kahn's algorithm for topological sort
    queue: List[str] = [node_id for node_id, deg in indegree.items() if deg == 0]
    execution_order: List[str] = []
    
    while queue:
        current_id = queue.pop(0)
        execution_order.append(current_id)
        for neighbor in adjacency[current_id]:
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)
    
    # Execute nodes in computed order
    # Filter out control-flow nodes that don't generate commands
    control_flow_types = {'foreachModel', 'chainFileOutput', 'excelModels', 'setVariable'}
    for node_id in execution_order:
        node = id_to_node.get(node_id)
        if node:
            node_type = node.get('type')
            # Only execute nodes that generate commands (skip control-flow nodes)
            if node_type not in control_flow_types:
                execute_node(node, model_name, variables, per_run_vars, xml_content, output_folder)
    
    return xml_content


def generate_chain_file(
    model_name: str,
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    variables: List[Dict[str, Any]],
    per_run_vars: Dict[str, Any],
    output_folder: str,
    project_folder: str = '',
) -> Optional[str]:
    """
    Generate a single chain file for a model
    
    Args:
        model_name: Model name (filename stem)
        nodes: Workflow graph nodes
        edges: Workflow graph edges
        variables: Variable bindings
        per_run_vars: Per-run variable values
        output_folder: Output folder path
        project_folder: Project folder path
    
    Returns:
        Path to generated chain file or None
    """
    # Determine model type from chainFileOutput node
    chain_output_node = next((n for n in nodes if n.get('type') == 'chainFileOutput'), None)
    model_type = 'Model'
    if chain_output_node:
        model_type = chain_output_node.get('data', {}).get('modelType', 'Model')
    
    xml_content = []
    
    # Always add opening scaffolding
    if model_type == 'TIN':
        xml_content.extend(generate_xml_header(date="2024-01-16", time="20:57:27"))
        xml_content.extend(generate_meta_data_tin(project_folder or '', model_name))
    else:
        xml_content.extend(generate_xml_header(date="2023-10-13", time="08:35:06"))
        xml_content.extend(generate_meta_data_model(project_folder or '', model_name))
    
    xml_content.extend(generate_chain_wrapper())
    xml_content.extend(generate_chain_settings())
    
    # Build command chain from graph
    command_xml = build_command_chain(nodes, edges, model_name, variables, per_run_vars, model_type, output_folder)
    xml_content.extend(command_xml)
    
    # Always add closing scaffolding
    xml_content.extend(generate_chain_closing())
    
    # Write file
    output_file = os.path.join(output_folder, f'{model_name}.chain')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(xml_content))
    
    return output_file


def run_workflow(
    excel_file_path: str,
    workflow_graph: Dict[str, Any],
    variables: List[Dict[str, Any]],
    output_folder: str,
) -> Tuple[List[str], Optional[str], List[Dict[str, str]]]:
    """
    Run a workflow graph for all models in Excel file
    
    Args:
        excel_file_path: Path to Excel file
        workflow_graph: Workflow graph JSON (nodes and edges)
        variables: Variable bindings
        output_folder: Output folder path
    
    Returns:
        Tuple of (generated file paths, project folder, file details)
    """
    # Parse Excel to get model names
    # Read Excel file directly without header to ensure we get ALL rows including first
    # This prevents pandas from treating the first row as a header and losing it
    try:
        df_raw = pd.read_excel(excel_file_path, engine='openpyxl', header=None)
        # Get all values from first column (index 0)
        model_names_raw = df_raw.iloc[:, 0].astype(str).tolist()
    except Exception as e:
        # Fallback to using load_naming_data if direct read fails
        naming_data = load_naming_data(excel_file_path)
        if naming_data is None:
            raise ValueError("Error loading naming data from Excel file")
        model_names_raw = naming_data.iloc[:, 0].astype(str).tolist()
    
    # Filter out empty strings and 'nan'
    # Check if first value looks like a header (common header names)
    common_headers = ['filename', 'name', 'model', 'model_name', 'model name']
    model_names = []
    for i, m in enumerate(model_names_raw):
        m_clean = m.strip() if m else ''
        # Skip if empty or 'nan'
        if not m_clean or m_clean.lower() == 'nan':
            continue
        # Skip first row only if it matches a common header name
        if i == 0 and m_clean.lower() in common_headers:
            continue
        model_names.append(m_clean)
    
    # Extract nodes and edges from graph
    nodes = workflow_graph.get('nodes', [])
    edges = workflow_graph.get('edges', [])

    # Optional subset of model names selected in the frontend
    selected_model_names = workflow_graph.get('selectedModelNames') or []
    if selected_model_names:
        selected_set = {str(name) for name in selected_model_names}
        model_names = [m for m in model_names if str(m) in selected_set]
    
    # Build per-run variables
    per_run_vars = {}
    for var in variables:
        if var.get('scope') == 'per-run':
            per_run_vars[var.get('name')] = var.get('value')

    # Determine which variable should be used for the project folder.
    # Prefer the variable selected on the Chain File Output node (projectFolder param),
    # falling back to the legacy hard-coded name 'project_folder' for backwards compatibility.
    chain_output_node = next(
        (n for n in workflow_graph.get('nodes', []) if n.get('type') == 'chainFileOutput'),
        None,
    )
    project_folder_var_name = None
    if chain_output_node:
        data = chain_output_node.get('data', {})
        project_folder_var_name = data.get('projectFolder') or None

    if not project_folder_var_name:
        project_folder_var_name = 'project_folder'

    # Get project folder value from per-run variables (may be empty if not set)
    project_folder = per_run_vars.get(project_folder_var_name, '')
    
    generated_files = []
    file_details = []
    
    # Generate chain file for each model
    for model_name in model_names:
        chain_file = generate_chain_file(
            model_name,
            nodes,
            edges,
            variables,
            per_run_vars,
            output_folder,
            project_folder,
        )
        if chain_file:
            generated_files.append(chain_file)
            file_details.append({
                'filename': os.path.basename(chain_file),
                'output_path': chain_file,
                'project_folder': project_folder,
            })
    
    return generated_files, project_folder, file_details

