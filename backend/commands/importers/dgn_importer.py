"""
DGN file importer - generates XML content for Read DGN File command
"""
from typing import List
from .utils import normalize_file_path


def generate_dgn_xml_content(actual_file_path: str, modified_variable: str) -> List[str]:
    """
    Generate XML content for DGN files
    
    Args:
        actual_file_path: Full path to the DGN file
        modified_variable: Variable name for the model
        
    Returns:
        List of XML lines for the DGN import command
    """
    xml_content = []
    
    xml_content.append('      <Run_option>')
    xml_content.append('        <Name>Read DGN File</Name>')
    xml_content.append('        <Active>true</Active>')
    xml_content.append('        <Continue_on_failure>false</Continue_on_failure>')
    xml_content.append('        <Uses_parameters>false</Uses_parameters>')
    xml_content.append('        <Interactive>false</Interactive>')
    xml_content.append('        <Comments>')
    xml_content.append('        </Comments>')
    xml_content.append('        <SLF_data>')
    xml_content.append('          <screen_layout>')
    xml_content.append('            <version>1.0</version>')
    xml_content.append('            <panel>')
    xml_content.append('              <name>Read DGN external v78</name>')
    xml_content.append('              <x>303</x>')
    xml_content.append('              <y>312</y>')
    xml_content.append('              <resize>')
    xml_content.append('                <width>1.4115942</width>')
    xml_content.append('                <height>1</height>')
    xml_content.append('              </resize>')
    xml_content.append('              <tick_box>')
    xml_content.append('                <name>Create anonymous function</name>')
    xml_content.append('                <value>false</value>')
    xml_content.append('              </tick_box>')
    xml_content.append('              <input_box>')
    xml_content.append('                <name>Import method</name>')
    xml_content.append('                <value/>')
    xml_content.append('              </input_box>')
    xml_content.append('              <file_box>')
    xml_content.append('                <name>File</name>')
    formatted_path = normalize_file_path(actual_file_path).replace('\\', '/')
    xml_content.append(f'                <value>{formatted_path}</value>')
    xml_content.append('              </file_box>')
    xml_content.append('              <file_box>')
    xml_content.append('                <name>Mapfile</name>')
    xml_content.append('                <value/>')
    xml_content.append('              </file_box>')
    xml_content.append('              <input_box>')
    xml_content.append('                <name>Mapfile key</name>')
    xml_content.append('                <value/>')
    xml_content.append('              </input_box>')
    xml_content.append('              <input_box>')
    xml_content.append('                <name>Pre*postfix for models</name>')
    xml_content.append(f'                <value>{modified_variable}/*</value>')
    xml_content.append('              </input_box>')
    xml_content.append('              <input_box>')
    xml_content.append('                <name>Allow merge into existing models</name>')
    xml_content.append('                <value>yes</value>')
    xml_content.append('              </input_box>')
    xml_content.append('              <input_box>')
    xml_content.append('                <name>Level name as model</name>')
    xml_content.append('                <value>yes</value>')
    xml_content.append('              </input_box>')
    xml_content.append('              <input_box>')
    xml_content.append('                <name>Hidden levels</name>')
    xml_content.append('                <value>no</value>')
    xml_content.append('              </input_box>')
    xml_content.append('              <input_box>')
    xml_content.append('                <name>Frozen levels</name>')
    xml_content.append('                <value>no</value>')
    xml_content.append('              </input_box>')
    xml_content.append('              <input_box>')
    xml_content.append('                <name>Invisible elements</name>')
    xml_content.append('                <value>no</value>')
    xml_content.append('              </input_box>')
    xml_content.append('              <input_box>')
    xml_content.append('                <name>Combine elements</name>')
    xml_content.append('                <value>no</value>')
    xml_content.append('              </input_box>')
    xml_content.append('              <input_box>')
    xml_content.append('                <name>Shapes as faces</name>')
    xml_content.append('                <value>no</value>')
    xml_content.append('              </input_box>')
    xml_content.append('              <input_box>')
    xml_content.append('                <name>Text as super strings</name>')
    xml_content.append('                <value>no</value>')
    xml_content.append('              </input_box>')
    xml_content.append('              <input_box>')
    xml_content.append('                <name>Create symbols</name>')
    xml_content.append('                <value>no</value>')
    xml_content.append('              </input_box>')
    xml_content.append('              <input_box>')
    xml_content.append('                <name>Load xref files</name>')
    xml_content.append('                <value>no</value>')
    xml_content.append('              </input_box>')
    xml_content.append('              <run_button>')
    xml_content.append('                <name>&amp;Read</name>')
    xml_content.append('              </run_button>')
    xml_content.append('            </panel>')
    xml_content.append('          </screen_layout>')
    xml_content.append('        </SLF_data>')
    xml_content.append('        <Parameter_Mappings>')
    xml_content.append('        </Parameter_Mappings>')
    xml_content.append('      </Run_option>')
    
    return xml_content

