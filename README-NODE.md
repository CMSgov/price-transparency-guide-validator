# price-transparency-guide-validator Node.js wrapper

Convenience tool to wrap a call to the validation executable.

#### Installation

Clone the repository:

```bash
git clone https://github.com/CMSgov/price-transparency-guide-validator
```

Install tool (may require escalated privileges):

```bash
npm install -g .
```

Run the tool:

```bash
# Help with command-line usage
cms-mrf-validator --help

# Run with command-line output
cms-mrf-validator path/to/schema.json path/to/data.json

# Run with file output
cms-mrf-validator path/to/schema.json path/to/data.json -o output-file.txt
```

#### Development

Remember to use prettier before making a commit. Some editors will do this for you.

```bash
npm run prettier
```
