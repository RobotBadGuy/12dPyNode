"""Utilities to create 12d attribute manipulator files (.12dattmf).

This module writes three specific files with fixed contents to a given
project folder. These are used by 12d when importing DGN:
- ModelAttrNameToStringName.12dattmf
- ModelNameToStringAttr.12dattmf
- StringAttrDeconcat.12dattmf
"""

from __future__ import annotations

import os
from typing import Iterable, Tuple


_MODEL_ATTR_NAME_TO_STRING_NAME = """<Rules>
    <Rule>
        <Attribute_To_Use>
            <String_Attribute_Rule>
                <Name>strName</Name>
                <Evaluate_Default>true</Evaluate_Default>
                <Expected_Type>Unknown</Expected_Type>
                <Delimeter/>
                <Action_mode>0</Action_mode>
            </String_Attribute_Rule>
        </Attribute_To_Use>
        <Attribute_To_Modify>
            <Property_Rule>
                <Name/>
                <Evaluate_Default>true</Evaluate_Default>
                <Property_Type>0</Property_Type>
            </Property_Rule>
        </Attribute_To_Modify>
        <Active>1</Active>
        <Comment/>
    </Rule>
</Rules>
"""

_MODEL_NAME_TO_STRING_ATTR = """<Rules>
    <Rule>
        <Attribute_To_Use>
            <Property_Rule>
                <Name/>
                <Evaluate_Default>true</Evaluate_Default>
                <Property_Type>27</Property_Type>
            </Property_Rule>
        </Attribute_To_Use>
        <Attribute_To_Modify>
            <String_Attribute_Rule>
                <Name>ModelName</Name>
                <Evaluate_Default>true</Evaluate_Default>
                <Expected_Type>Text</Expected_Type>
                <Delimeter/>
                <Action_mode>0</Action_mode>
            </String_Attribute_Rule>
        </Attribute_To_Modify>
        <Active>1</Active>
        <Comment/>
    </Rule>
</Rules>
"""

_STRING_ATTR_DECONCAT = """<Rules>
    <Rule>
        <Attribute_To_Use>
        </Attribute_To_Use>
        <Attribute_To_Modify>
            <String_Attribute_Rule>
                <Name>ModelName</Name>
                <Default_Value>{fileName}/{strName}</Default_Value>
                <Evaluate_Default>true</Evaluate_Default>
                <Expected_Type>Deconcat</Expected_Type>
                <Delimeter/>
                <Action_mode>0</Action_mode>
            </String_Attribute_Rule>
        </Attribute_To_Modify>
        <Active>1</Active>
        <Comment/>
    </Rule>
</Rules>
"""


def _ensure_dir(path: str) -> None:
        if not path:
                raise ValueError("Project folder path is empty.")
        os.makedirs(path, exist_ok=True)


def _write_text(path: str, content: str) -> None:
        with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(content)


def create_attr_manipulator_files(project_folder: str) -> Tuple[str, str, str]:
        """Create the three required .12dattmf files in the given folder.

        Returns a tuple with the absolute paths of the created files.
        Overwrites existing files to ensure correct content.
        """
        _ensure_dir(project_folder)

        targets: Iterable[Tuple[str, str]] = (
                ("ModelAttrNameToStringName.12dattmf", _MODEL_ATTR_NAME_TO_STRING_NAME),
                ("ModelNameToStringAttr.12dattmf", _MODEL_NAME_TO_STRING_ATTR),
                ("StringAttrDeconcat.12dattmf", _STRING_ATTR_DECONCAT),
        )

        created_paths = []
        for filename, content in targets:
                full_path = os.path.join(project_folder, filename)
                _write_text(full_path, content)
                created_paths.append(full_path)

        return tuple(created_paths)  # type: ignore[return-value]
