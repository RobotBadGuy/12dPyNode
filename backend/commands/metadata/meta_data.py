"""
Generate meta_data section with units and application info
"""
from typing import List


def generate_meta_data_tin(
    project_folder: str,
    variable: str,
    export_date_gmt: str = "2024-01-16T09:57:27Z",
    export_date: str = "2024-01-16T20:57:27"
) -> List[str]:
    """
    Generate meta_data section for TIN processing
    
    Args:
        project_folder: Project folder path
        variable: Variable name (filename stem)
        export_date_gmt: Export date GMT (default: "2024-01-16T09:57:27Z")
        export_date: Export date (default: "2024-01-16T20:57:27")
    
    Returns:
        List of XML lines for meta_data section
    """
    return [
        '  <meta_data>',
        '    <units>',
        '      <metric>',
        '        <linear>metre</linear>',
        '        <area>square metre</area>',
        '        <volume>cubic metre</volume>',
        '        <temperature>celsius</temperature>',
        '        <pressure>millibars</pressure>',
        '        <angular>decimal degrees</angular>',
        '        <direction>decimal degrees</direction>',
        '      </metric>',
        '    </units>',
        '    <application>',
        '      <name>12d Model</name>',
        '      <manufacturer>12d Solutions Pty Ltd</manufacturer>',
        '      <manufacturer_url>www.12d.com</manufacturer_url>',
        '      <application>12d Model 15.0C1j</application>',
        '      <application_build>15.1.10.22</application_build>',
        '      <application_path>C:\\Program Files\\12d\\12dmodel\\15.00\\nt.x64\\12d.exe</application_path>',
        '      <application_date_gmt>2023-06-16T00:33:18Z</application_date_gmt>',
        '      <application_date>2023-06-16T10:33:18</application_date>',
        '      <project_name>Project</project_name>',
        '      <project_guid>{33C24EEB-4DA8-499f-B390-8960A7A2FF8D}</project_guid>',
        f'      <project_folder>{project_folder}</project_folder>',
        '      <client>Boxmon</client>',
        '      <dongle>ec514701fc</dongle>',
        '      <maintenance>active</maintenance>',
        '      <environment/>',
        '      <env4d>c:\\12d\\15.00\\user\\env.4d</env4d>',
        '      <user>K132177</user>',
        f'      <export_file_name>{variable} Chain.chain</export_file_name>',
        f'      <export_date_gmt>{export_date_gmt}</export_date_gmt>',
        f'      <export_date>{export_date}</export_date>',
        '    </application>',
        '  </meta_data>'
    ]


def generate_meta_data_model(
    project_folder: str,
    variable: str,
    export_date_gmt: str = "2023-10-12T21:35:06Z",
    export_date: str = "2023-10-13T08:35:06"
) -> List[str]:
    """
    Generate meta_data section for standard Model processing
    
    Args:
        project_folder: Project folder path
        variable: Variable name (filename stem)
        export_date_gmt: Export date GMT (default: "2023-10-12T21:35:06Z")
        export_date: Export date (default: "2023-10-13T08:35:06")
    
    Returns:
        List of XML lines for meta_data section
    """
    return [
        '  <meta_data>',
        '    <units>',
        '      <metric>',
        '        <linear>metre</linear>',
        '        <area>square metre</area>',
        '        <volume>cubic metre</volume>',
        '        <temperature>celsius</temperature>',
        '        <pressure>millibars</pressure>',
        '        <angular>decimal degrees</angular>',
        '        <direction>decimal degrees</direction>',
        '      </metric>',
        '    </units>',
        '    <application>',
        '      <name>12d Model</name>',
        '      <manufacturer>12d Solutions Pty Ltd</manufacturer>',
        '      <manufacturer_url>www.12d.com</manufacturer_url>',
        '      <application>12d Model 15.0C1j</application>',
        '      <application_build>15.1.10.22</application_build>',
        '      <application_path>C:\\Program Files\\12d\\12dmodel\\15.00\\nt.x64\\12d.exe</application_path>',
        '      <application_date_gmt>2023-06-16T00:33:18Z</application_date_gmt>',
        '      <application_date>2023-06-16T10:33:18</application_date>',
        '      <project_name>Master</project_name>',
        '      <project_guid>{33C24EEB-4DA8-499f-B390-8960A7A2FF8D}</project_guid>',
        f'      <project_folder>{project_folder}</project_folder>',
        '      <client>Boxmon</client>',
        '      <dongle>ec514701fc</dongle>',
        '      <maintenance>active</maintenance>',
        '      <environment/>',
        '      <env4d>c:\\12d\\15.00\\user\\env.4d</env4d>',
        '      <user>Boxmon 12dPynode User</user>',
        f'      <export_file_name>{variable} Chain.chain</export_file_name>',
        f'      <export_date_gmt>{export_date_gmt}</export_date_gmt>',
        f'      <export_date>{export_date}</export_date>',
        '    </application>',
        '  </meta_data>'
    ]



