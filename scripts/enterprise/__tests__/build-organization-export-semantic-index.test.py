import json
import pathlib
import subprocess
import tempfile
import unittest


SCRIPT = pathlib.Path(__file__).parents[1] / "build-organization-export-semantic-index.py"


class SemanticIndexSchemaTest(unittest.TestCase):
    def run_index(self, source):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            source_path = root / "server/src/writer.ts"
            source_path.parent.mkdir(parents=True)
            source_path.write_text(source)
            inventory = root / "inventory.json"
            inventory.write_text(json.dumps({"tables": [
                {"schema": "public", "table": "shared_name"},
                {"schema": "v8", "table": "shared_name"},
            ]}))
            output = root / "semantic.json"
            subprocess.run([
                "python3", str(SCRIPT), "--inventory", str(inventory),
                "--repository-root", str(root), "--out", str(output),
            ], check=True, capture_output=True, text=True)
            return {f"{row['schema']}.{row['table']}": row for row in json.loads(output.read_text())["entries"]}

    def test_unqualified_writer_authorizes_public_only(self):
        rows = self.run_index("const q = `INSERT INTO shared_name(id) VALUES (1)`;\n")
        self.assertEqual(len(rows["public.shared_name"]["sources"]), 1)
        self.assertEqual(rows["v8.shared_name"]["sources"], [])

    def test_schema_qualified_writer_authorizes_v8_only(self):
        rows = self.run_index("const q = `INSERT INTO v8.shared_name(id) VALUES (1)`;\n")
        self.assertEqual(rows["public.shared_name"]["sources"], [])
        self.assertEqual(len(rows["v8.shared_name"]["sources"]), 1)


if __name__ == "__main__":
    unittest.main()
