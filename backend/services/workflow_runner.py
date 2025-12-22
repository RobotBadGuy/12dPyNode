"""
Workflow Runner - Executes node-based workflow graphs to generate chain files
"""

import os
import json
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
from commands.models import clean_model_command
from commands.run_options import (
    delete_models_from_view_command,
    create_shared_model_command,
)
from commands.functions import if_function_exists_command
from commands.tin import (
    triangulate_manual_option_command,
    tin_function_command,
)
from commands.importers import (
    generate_ifc_xml_content,
    generate_dwg_xml_content,
    generate_dgn_xml_content,
)


def resolve_variable(
    var_name: str,
    model_name: str,
    variables: List[Dict[str, Any]],
    per_run_vars: Dict[str, Any],
) -> str:
    """
    Resolve a variable reference to its actual value
    
    Args:
        var_name: Variable name to resolve
        model_name: Current model name (for per-model variables)
        variables: List of variable bindings
        per_run_vars: Per-run variable values
    
    Returns:
        Resolved variable value as string
    """
    # Check per-run variables first
    if var_name in per_run_vars:
        return str(per_run_vars[var_name])
    
    # Check variable bindings
    for var in variables:
        if var.get('name') == var_name:
            value = var.get('value', '')
            # If it's a per-model variable and contains {model_name}, substitute
            if var.get('scope') == 'per-model' and isinstance(value, str):
                return value.replace('{model_name}', model_name)
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
        modified_variable = resolve_variable(data.get('modifiedVariable', 'modified_variable'), model_name, variables, per_run_vars)
        coordinates = data.get('coordinates', [40, 30, 565, 715])
        xml_content.extend(create_view_command(modified_variable, coordinates=tuple(coordinates)))
    
    elif node_type == 'addModelToView':
        modified_variable = resolve_variable(data.get('modifiedVariable', 'modified_variable'), model_name, variables, per_run_vars)
        xml_content.extend(add_model_to_view_command(modified_variable))
    
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
    
    elif node_type == 'ifFunctionExists':
        modified_variable = resolve_variable(data.get('modifiedVariable', 'modified_variable'), model_name, variables, per_run_vars)
        function_name = resolve_variable(data.get('functionName', 'function_name'), model_name, variables, per_run_vars)
        xml_content.extend(if_function_exists_command(modified_variable, function_name))


def build_command_chain(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    model_name: str,
    variables: List[Dict[str, Any]],
    per_run_vars: Dict[str, Any],
    model_type: str = 'Model',
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
    chain_output_node = next((n for n in nodes if n.get('type') == 'chainFileOutput'), None)
    
    if foreach_node and chain_output_node:
        foreach_id = foreach_node.get('id')
        chain_output_id = chain_output_node.get('id')

        execution_order: List[str] = []
        visited: set[str] = set()

        def find_path(current_id: str, path: List[str]) -> None:
            """
            Depth-first search from foreach node to chainFileOutput node following
            only flow edges. When we reach the chainFileOutput node, record all
            nodes in the path *before* the chain output as the execution order.
            """
            if current_id in visited:
                return

            if current_id == chain_output_id:
                # path includes the chain output as the last element; we only want
                # to execute nodes leading up to it.
                if path:
                    execution_order.extend(path[:-1])
                return

            visited.add(current_id)

            # Find all nodes connected from current (only flow edges)
            for edge in edges:
                if edge.get('source') == current_id and is_flow_edge(edge):
                    target_id = edge.get('target')
                    if target_id:
                        find_path(target_id, path + [target_id])

        # Start from foreach and search for a path to chainFileOutput
        if foreach_id and chain_output_id:
            find_path(str(foreach_id), [str(foreach_id)])

        # Execute nodes in the discovered order
        for node_id in execution_order:
            node = next((n for n in nodes if str(n.get('id')) == str(node_id)), None)
            if node:
                execute_node(node, model_name, variables, per_run_vars, xml_content)

        return xml_content
    
    # Fallback: no foreach node – build a generic topological order using flow edges only
    # This allows workflows that don't use the Foreach Model node.
    node_ids = [str(n.get('id')) for n in nodes if n.get('id') is not None]
    id_to_node: Dict[str, Dict[str, Any]] = {str(n.get('id')): n for n in nodes if n.get('id') is not None}
    
    # Initialize graph structures
    indegree: Dict[str, int] = {node_id: 0 for node_id in node_ids}
    adjacency: Dict[str, List[str]] = {node_id: [] for node_id in node_ids}
    
    # Build adjacency and indegree from flow edges
    for edge in edges:
        if not is_flow_edge(edge):
            continue
        source_id = str(edge.get('source'))
        target_id = str(edge.get('target'))
        if source_id in adjacency and target_id in adjacency:
            adjacency[source_id].append(target_id)
            indegree[target_id] += 1
    
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
    for node_id in execution_order:
        node = id_to_node.get(node_id)
        if node:
            execute_node(node, model_name, variables, per_run_vars, xml_content)
    
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
    command_xml = build_command_chain(nodes, edges, model_name, variables, per_run_vars, model_type)
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
    naming_data = load_naming_data(excel_file_path)
    if naming_data is None:
        raise ValueError("Error loading naming data from Excel file")
    
    # Get model names from first column
    model_names = naming_data.iloc[:, 0].astype(str).tolist()
    model_names = [m for m in model_names if m and m != 'nan']
    
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
    
    # Get project folder from variables or default
    project_folder = per_run_vars.get('project_folder', '')
    
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

