"""
Generate Create/Apply MTF command
"""
from typing import List


def create_apply_mtf(
    function_name: str,
    mtf_file_name: str,
    reference_model_name: str,
    volumes_report_name: str,
    String_Model_Name: str,
    Section_Model_Name: str,
    Road_Tin_Model_Name: str,
    model_for_tin_name: str,
    Tadpole_Model_Name: str,
) -> List[str]:
    """
    Generate If_function_exists with Create/Run MTF Function XML commands
    
    Args:
        function_name: Template function name
        mtf_file_name: Name of the MTF file (without extension)
        reference_model_name: Reference model name
        volumes_report_name: Volumes report file name (without extension)
        String_Model_Name: Model name for strings
        Section_Model_Name: Model name for sections
        Road_Tin_Model_Name: Road TIN model name
        model_for_tin_name: Model name for the generated TIN
        Tadpole_Model_Name: Model name for tadpoles
    
    Returns:
        List of XML lines for Run or Create MTF command
    """
    xml_string = rf"""
      <Manual_option>
        <Name>Create MTF file</Name>
        <Active>true</Active>
        <Continue_on_failure>false</Continue_on_failure>
        <Uses_parameters>false</Uses_parameters>
        <Interactive>false</Interactive>
        <Comments>
        </Comments>
        <Panel_Data><screen_layout>
          <version>1.0</version>
          <panel>
            <name>Apply Templates Function</name>
            <x>241</x>
            <y>322</y>
            <widget_pages>
              <name>Tabs</name>
              <current_page>Main</current_page>
              <widget_page>
                <name>Main</name>
                <input_box>
                  <name>Function name</name>
                  <value>{function_name}</value>
                </input_box>
                <input_box>
                  <name>Tin</name>
                  <value>tin Survey</value>
                </input_box>
                <file_box>
                  <name>MTF file</name>
                  <value>{mtf_file_name}.mtf</value>
                </file_box>
                <tick_box>
                  <name>V6 compatible</name>
                  <value>false</value>
                </tick_box>
                <input_box>
                  <name>LHS prefix</name>
                  <value />
                </input_box>
                <input_box>
                  <name>RHS prefix</name>
                  <value />
                </input_box>
                <select_box>
                  <name>Reference</name>
                  <value>
                    <cell_value>{reference_model_name}</cell_value>
                    <model_id></model_id>
                    <name>{reference_model_name}</name>
                    <id>15222</id>
                  </value>
                </select_box>
                <select_box>
                  <name>Hinge</name>
                </select_box>
                <input_box>
                  <name>Start mode</name>
                  <value>Start  (ref)</value>
                </input_box>
                <widget_pages>
                  <name>Start Chainage Pages</name>
                  <current_page>2</current_page>
                  <widget_page>
                    <name>1</name>
                    <input_box>
                      <name>Chainage</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>2</name>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>3</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>4</name>
                    <input_box>
                      <name>Part</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>5</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Part</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>6</name>
                    <input_box>
                      <name>Position</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>7</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Position</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>8</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Intersect no.</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>9</name>
                    <input_box>
                      <name>Link</name>
                      <value />
                    </input_box>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>10</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>11</name>
                    <input_box>
                      <name>Model</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Wildcard</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>12</name>
                    <select_box>
                      <name>String 1</name>
                    </select_box>
                    <select_box>
                      <name>String 2</name>
                    </select_box>
                    <input_box>
                      <name>Intersect no.</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>13</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>14</name>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>15</name>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>16</name>
                    <input_box>
                      <name>Rows back</name>
                      <value>1</value>
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>17</name>
                    <input_box>
                      <name>Model</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Wildcard</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Max os left</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Max os right</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>18</name>
                    <xyz_box>
                      <name>Point</name>
                      <input_box>
                        <name>X coordinate</name>
                        <value />
                      </input_box>
                      <input_box>
                        <name>Y coordinate</name>
                        <value />
                      </input_box>
                    </xyz_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>19</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <xyz_box>
                      <name>Point</name>
                      <input_box>
                        <name>X coordinate</name>
                        <value />
                      </input_box>
                      <input_box>
                        <name>Y coordinate</name>
                        <value />
                      </input_box>
                    </xyz_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>20</name>
                    <input_box>
                      <name>Alias</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>21</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Max drop dist</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>22</name>
                    <input_box>
                      <name>Link</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Intersect no.</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>23</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>24</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Chainage</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>25</name>
                    <select_box>
                      <name>Water string</name>
                    </select_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                </widget_pages>
                <input_box>
                  <name>End mode</name>
                  <value>End  (ref)</value>
                </input_box>
                <widget_pages>
                  <name>End Chainage Pages</name>
                  <current_page>2</current_page>
                  <widget_page>
                    <name>1</name>
                    <input_box>
                      <name>Chainage</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>2</name>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>3</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>4</name>
                    <input_box>
                      <name>Part</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>5</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Part</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>6</name>
                    <input_box>
                      <name>Position</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>7</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Position</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>8</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Intersect no.</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>9</name>
                    <input_box>
                      <name>Link</name>
                      <value />
                    </input_box>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>10</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>11</name>
                    <input_box>
                      <name>Model</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Wildcard</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>12</name>
                    <select_box>
                      <name>String 1</name>
                    </select_box>
                    <select_box>
                      <name>String 2</name>
                    </select_box>
                    <input_box>
                      <name>Intersect no.</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>13</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>14</name>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>15</name>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>16</name>
                    <input_box>
                      <name>Rows back</name>
                      <value>1</value>
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>17</name>
                    <input_box>
                      <name>Model</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Wildcard</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Max os left</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Max os right</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>18</name>
                    <xyz_box>
                      <name>Point</name>
                      <input_box>
                        <name>X coordinate</name>
                        <value />
                      </input_box>
                      <input_box>
                        <name>Y coordinate</name>
                        <value />
                      </input_box>
                    </xyz_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>19</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <xyz_box>
                      <name>Point</name>
                      <input_box>
                        <name>X coordinate</name>
                        <value />
                      </input_box>
                      <input_box>
                        <name>Y coordinate</name>
                        <value />
                      </input_box>
                    </xyz_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>20</name>
                    <input_box>
                      <name>Alias</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>21</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Max drop dist</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>22</name>
                    <input_box>
                      <name>Link</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Intersect no.</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>23</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>24</name>
                    <select_box>
                      <name>String</name>
                    </select_box>
                    <input_box>
                      <name>Chainage</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension other</name>
                      <value />
                    </input_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                  <widget_page>
                    <name>25</name>
                    <select_box>
                      <name>Water string</name>
                    </select_box>
                    <input_box>
                      <name>Extension ref</name>
                      <value />
                    </input_box>
                  </widget_page>
                </widget_pages>
                <input_box>
                  <name>Section separation</name>
                  <value>1</value>
                </input_box>
                <input_box>
                  <name>Report type</name>
                  <value>&lt;Legacy&gt;</value>
                </input_box>
                <file_box>
                  <name>Report file</name>
                  <value>{volumes_report_name}.rpt</value>
                </file_box>
              </widget_page>
              <widget_page>
                <name>Models</name>
                <grid_box>
                  <name>Apply Many Models</name>
                  <columns>
                    <column>Strings</column>
                    <column>Sections</column>
                    <column>Colour</column>
                  </columns>
                  <data>
                    <r><c>{String_Model_Name}</c><c>{Section_Model_Name}</c><c>red</c></r>
                    <r><c></c><c></c><c></c></r>
                    <r><c></c><c></c><c></c></r>
                    <r><c></c><c></c><c></c></r>
                    <r><c></c><c></c><c></c></r>
                    <r><c></c><c></c><c></c></r>
                    <r><c></c><c></c><c></c></r>
                    <r><c></c><c></c><c></c></r>
                    <r><c></c><c></c><c></c></r>
                  </data>
                </grid_box>
                <input_box>
                  <name>Model for polygons</name>
                  <value>{Polygon_Model_Name}</value>
                </input_box>
                <input_box>
                  <name>Model for road boundary</name>
                  <value>{Boundary_Model_Name}</value>
                </input_box>
              </widget_page>
              <widget_page>
                <name>Misc</name>
                <input_box>
                  <name>Create arcs</name>
                  <value>super arcs</value>
                </input_box>
                <input_box>
                  <name>Chord/Arc tolerance</name>
                  <value>0.01</value>
                </input_box>
                <tick_box>
                  <name>Volume correction for curves</name>
                  <value>true</value>
                </tick_box>
                <tick_box>
                  <name>Partial interfaces</name>
                  <value>true</value>
                </tick_box>
                <tick_box>
                  <name>Copy hinge</name>
                  <value>true</value>
                </tick_box>
                <tick_box>
                  <name>Use stripping</name>
                  <value>true</value>
                </tick_box>
                <tick_box>
                  <name>Show detailed stripping volumes</name>
                  <value>false</value>
                </tick_box>
                <tick_box>
                  <name>Calculate natural surface to design volumes</name>
                  <value>true</value>
                </tick_box>
                <tick_box>
                  <name>Calculate natural surface to subgrade volume</name>
                  <value>true</value>
                </tick_box>
                <tick_box>
                  <name>Calculate design to subgrade volume</name>
                  <value>false</value>
                </tick_box>
                <tick_box>
                  <name>Calculate trimesh/inter-boxing layer volumes</name>
                  <value>false</value>
                </tick_box>
                <file_box>
                  <name>Map file</name>
                  <value>$LIB\PW_DESIGN.mapfile</value>
                </file_box>
              </widget_page>
              <widget_page>
                <name>Tin</name>
                <tick_box>
                  <name>Create road tin</name>
                  <value>true</value>
                </tick_box>
                <input_box>
                  <name>Road tin</name>
                  <value>{Road_Tin_Model_Name}</value>
                </input_box>
                <input_box>
                  <name>Colour for tin</name>
                  <value>orange</value>
                </input_box>
                <input_box>
                  <name>Model for tin</name>
                  <value>{model_for_tin_name}</value>
                </input_box>
                <tick_box>
                  <name>Create depth range polygons</name>
                  <value>false</value>
                </tick_box>
                <file_box>
                  <name>Depth range file</name>
                  <value />
                </file_box>
                <input_box>
                  <name>Model for polygons</name>
                  <value>{model_for_polygons_name}</value>
                </input_box>
                <grid_box>
                  <name>Additional road tin models</name>
                  <columns>
                    <column>Extra model</column>
                  </columns>
                  <data>
                    <r>
                      <c>{additional_Road_tin_Model}</c>
                    </r>
                  </data>
                </grid_box>
              </widget_page>
              <widget_page>
                <name>Sight</name>
                <tick_box>
                  <name>Calculate sight distances</name>
                  <value>false</value>
                </tick_box>
                <input_box>
                  <name>Min sight dist</name>
                  <value>300</value>
                </input_box>
                <input_box>
                  <name>Eye height</name>
                  <value>1.15</value>
                </input_box>
                <input_box>
                  <name>Target height</name>
                  <value>1.15</value>
                </input_box>
                <input_box>
                  <name>Calc interval</name>
                  <value>100</value>
                </input_box>
                <input_box>
                  <name>Max sight dist</name>
                  <value>1000</value>
                </input_box>
                <input_box>
                  <name>Eye offset</name>
                  <value>0</value>
                </input_box>
                <input_box>
                  <name>Target offset</name>
                  <value>0</value>
                </input_box>
                <input_box>
                  <name>Trial interval</name>
                  <value>10</value>
                </input_box>
                <file_box>
                  <name>Report file</name>
                  <value />
                </file_box>
                <tick_box>
                  <name>Create separation/barrier lines</name>
                  <value>false</value>
                </tick_box>
                <input_box>
                  <name>Barrier distance</name>
                  <value>215</value>
                </input_box>
                <input_box>
                  <name>Min barrier road length</name>
                  <value>50</value>
                </input_box>
                <input_box>
                  <name>Min barrier line length</name>
                  <value>150</value>
                </input_box>
                <input_box>
                  <name>Min between barriers</name>
                  <value>250</value>
                </input_box>
              </widget_page>
              <widget_page>
                <name>Filter</name>
                <tick_box>
                  <name>Filter cross-sections</name>
                  <value>false</value>
                </tick_box>
                <input_box>
                  <name>Filtered sections model</name>
                  <value></value>
                </input_box>
                <input_box>
                  <name>Filtered sections colour</name>
                  <value>cyan</value>
                </input_box>
                <input_box>
                  <name>Regular filtering interval</name>
                  <value>20</value>
                </input_box>
                <input_box>
                  <name>Regular culling tolerance</name>
                  <value>0</value>
                </input_box>
                <tick_box>
                  <name>Include start section</name>
                  <value>true</value>
                </tick_box>
                <tick_box>
                  <name>Include end section</name>
                  <value>true</value>
                </tick_box>
                <tick_box>
                  <name>Include chainage equality sections</name>
                  <value>false</value>
                </tick_box>
                <tick_box>
                  <name>Include H tangent sections</name>
                  <value>true</value>
                </tick_box>
                <tick_box>
                  <name>Include V tangent sections</name>
                  <value>false</value>
                </tick_box>
                <tick_box>
                  <name>Include V crest/sag sections</name>
                  <value>false</value>
                </tick_box>
                <file_box>
                  <name>Special chainage file</name>
                  <value />
                </file_box>
              </widget_page>
              <widget_page>
                <name>Plot</name>
                <tick_box>
                  <name>Generate long-section plot(s)</name>
                  <value>false</value>
                </tick_box>
                <file_box>
                  <name>Long-section PPF</name>
                  <directory>bpworking.project</directory>
                  <value />
                </file_box>
                <plotter_box>
                  <name>Plotter type</name>
                  <value>model</value>
                </plotter_box>
                <file_box>
                  <name>Plot stem</name>
                  <value></value>
                </file_box>
                <tick_box>
                  <name>Clean plot model(s) beforehand</name>
                  <value>true</value>
                </tick_box>
                <tick_box>
                  <name>Generate cross-section plot(s)</name>
                  <value>false</value>
                </tick_box>
                <file_box>
                  <name>Cross-section PPF</name>
                  <directory>bpworking.project</directory>
                  <value />
                </file_box>
                <plotter_box>
                  <name>Plotter type</name>
                  <value>model</value>
                </plotter_box>
                <file_box>
                  <name>Plot stem</name>
                  <value></value>
                </file_box>
                <tick_box>
                  <name>Clean plot model(s) beforehand</name>
                  <value>true</value>
                </tick_box>
              </widget_page>
              <widget_page>
                <name>Tadpoles</name>
                <tick_box>
                  <name>Create tadpoles</name>
                  <value>true</value>
                </tick_box>
                <input_box>
                  <name>Tadpole model</name>
                  <value>{Tadpole_Model_Name}</value>
                </input_box>
                <input_box>
                  <name>Interval</name>
                  <value>5</value>
                </input_box>
                <input_box>
                  <name>Search width</name>
                  <value>5</value>
                </input_box>
                <input_box>
                  <name>Search side</name>
                  <value>Left only</value>
                </input_box>
                <grid_box>
                  <name>Tadpoles</name>
                  <columns>
                    <column>String 1</column>
                    <column>String 2</column>
                    <column>Start Ch.</column>
                    <column>End Ch.</column>
                    <column>Symbol 1</column>
                    <column>Symbol 1 %</column>
                    <column>Symbol 2</column>
                    <column>Symbol 2 %</column>
                  </columns>
                  <data>
                    <r>
                      <c>BNO3</c>
                      <c>int</c>
                      <c />
                      <c />
                      <c>
                        <style>Batter Tadpole2</style>
                        <colour>ppf symbols</colour>
                        <size>5</size>
                        <rotation>0</rotation>
                        <offset>0</offset>
                        <raise>0</raise>
                      </c>
                      <c>90</c>
                      <c />
                      <c>50</c>
                    </r>
                  </data>
                </grid_box>
              </widget_page>
              <widget_page>
                <name>Tadpoles (Adv)</name>
                <tick_box>
                  <name>Create tadpoles</name>
                  <value>false</value>
                </tick_box>
                <input_box>
                  <name>Tadpole style</name>
                  <value />
                </input_box>
                <input_box>
                  <name>Explode symbols</name>
                  <value>Don&apos;t explode</value>
                </input_box>
                <input_box>
                  <name>Drape tin</name>
                  <value />
                </input_box>
                <input_box>
                  <name>Strings model</name>
                  <value />
                </input_box>
                <input_box>
                  <name>Tadpole model</name>
                  <value />
                </input_box>
              </widget_page>
            </widget_pages>
            <run_button>
              <name>&amp;Apply</name>
            </run_button>
          </panel>
        </screen_layout>
        </Panel_Data>
        <Panel_Name>Apply Templates Function</Panel_Name>
        <Clean_Up>1</Clean_Up>
        <Buttons>
          <Button>
            <Name>&amp;Apply</Name>
            <Order>0</Order>
          </Button>
        </Buttons>
        <Parameter_Mappings>
        </Parameter_Mappings>
      </Manual_option>

          """
    # Split into lines and return non-empty lines (preserving indentation)
    return [line.rstrip() for line in xml_string.strip().split('\n') if line.strip()]
