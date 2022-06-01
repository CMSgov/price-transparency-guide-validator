import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.PrintWriter;

import javax.xml.XMLConstants;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.transform.sax.SAXSource;
import javax.xml.validation.*;

import org.xml.sax.InputSource;
import org.xml.sax.SAXException;
import org.xml.sax.SAXParseException;

public class CmsMrfValidator {
  public static void main(String[] args) throws SAXException, ParserConfigurationException, IOException {
    if (args.length < 2 || args.length > 3) {
      System.out.println("Usage: java CmsMrfValidator <path to schema> <path to data> [path to output]");
      System.exit(1);
    }
    PrintWriter outputWriter = null;
    if(args.length == 3) {
      try {
        outputWriter = new PrintWriter(new File(args[2]));
      } catch (Exception ex) {
        System.err.printf("Unable to open file %s for output.\n", args[2]);
        System.exit(1);
      }
    } else {
      outputWriter = new PrintWriter(System.out);
    }
    SchemaFactory factory = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
    Schema cookieSchema = null;
    try {
      cookieSchema = factory.newSchema(new File(args[0]));
    } catch (SAXException ex) {
      if (ex.getException() instanceof FileNotFoundException) {
        System.err.printf("Error opening schema: %s\n", ex.getException().getMessage());
      } else if (ex instanceof SAXParseException) {
        System.err.printf("Error parsing schema:\nLine: %d, Column: %d\n", ((SAXParseException) ex).getLineNumber(),
            ((SAXParseException) ex).getColumnNumber());
        System.err.println(ex.getMessage());
      } else {
        System.err.println(ex.getMessage());
      }
      System.exit(1);
    }
    Validator val = cookieSchema.newValidator();

    InputSource is = new InputSource();
    try {
      is.setByteStream(new FileInputStream(args[1]));
    } catch (FileNotFoundException ex) {
      System.err.printf("Error opening data file: %s\n", ex.getMessage());
      System.exit(1);
    }
    try {
      SAXSource saxSource = new SAXSource(is);
      val.validate(saxSource);
    } catch (SAXException ex) {
      outputWriter.println("Validation failure.");
      if (ex instanceof SAXParseException) {
        outputWriter.printf("Line: %d, Column: %d\n", ((SAXParseException) ex).getLineNumber(),
            ((SAXParseException) ex).getColumnNumber());
      }
      outputWriter.println(ex.getMessage());
      outputWriter.close();
      System.exit(1);
    }
    outputWriter.println("Validation successful.");
    outputWriter.close();
    System.exit(0);
  }
}