import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { 
  Bold, 
  Italic, 
  Code, 
  Smile
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

const EMOJI_CATEGORIES = {
  "Faces": ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳"],
  "Trading": ["📈", "📉", "💰", "💵", "💎", "🚀", "🔥", "⚡", "🎯", "📊", "🏆", "💪", "👍", "👎", "✅", "❌", "⭐", "🌟", "💯", "🔴", "🟢", "🟡", "🔵"],
  "Symbols": ["🚨", "⚠️", "💡", "🔔", "📢", "📣", "⏰", "⏳", "🎉", "🎊", "✨", "💫", "⭐", "🌟", "🔥", "💥", "⚡", "🌈", "🎯", "🎪", "🎨", "🎭"],
  "Numbers": ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "#️⃣", "*️⃣", "0️⃣"]
};

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Enter your message template...",
  className,
  minHeight = 200
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const handleSelectionChange = () => {
        setSelectionStart(textarea.selectionStart);
        setSelectionEnd(textarea.selectionEnd);
      };

      textarea.addEventListener('selectionchange', handleSelectionChange);
      textarea.addEventListener('keyup', handleSelectionChange);
      textarea.addEventListener('mouseup', handleSelectionChange);

      return () => {
        textarea.removeEventListener('selectionchange', handleSelectionChange);
        textarea.removeEventListener('keyup', handleSelectionChange);
        textarea.removeEventListener('mouseup', handleSelectionChange);
      };
    }
  }, []);

  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + textToInsert + value.substring(end);
    
    onChange(newValue);
    
    // Set cursor position after the inserted text
    setTimeout(() => {
      const newPosition = start + textToInsert.length;
      textarea.setSelectionRange(newPosition, newPosition);
      textarea.focus();
    }, 0);
  };

  const wrapSelectedText = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    let newText;
    if (selectedText) {
      // Wrap selected text
      newText = prefix + selectedText + suffix;
    } else {
      // Insert tags and place cursor between them
      newText = prefix + suffix;
    }
    
    const newValue = value.substring(0, start) + newText + value.substring(end);
    onChange(newValue);
    
    // Set cursor position
    setTimeout(() => {
      if (selectedText) {
        // Select the wrapped text
        textarea.setSelectionRange(start, start + newText.length);
      } else {
        // Place cursor between the tags
        const cursorPos = start + prefix.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }
      textarea.focus();
    }, 0);
  };

  const insertEmoji = (emoji: string) => {
    insertTextAtCursor(emoji);
  };

  const renderFormattedPreview = () => {
    let preview = value;
    
    // Convert formatting to HTML for preview
    preview = preview
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>')
      .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<strong>$1</strong>')
      .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, '<em>$1</em>')
      .replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>');

    return { __html: preview };
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-0">
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-3 border-b bg-muted/20">
          {/* Formatting buttons */}
          <div className="flex items-center gap-1 border-r pr-2 mr-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => wrapSelectedText("**", "**")}
              className="h-8 w-8 p-0"
              data-testid="button-format-bold"
              title="Bold (Markdown: **text** or HTML: <b>text</b>)"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => wrapSelectedText("*", "*")}
              className="h-8 w-8 p-0"
              data-testid="button-format-italic"
              title="Italic (Markdown: *text* or HTML: <i>text</i>)"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => wrapSelectedText("`", "`")}
              className="h-8 w-8 p-0"
              data-testid="button-format-code"
              title="Code (Markdown: `text` or HTML: <code>text</code>)"
            >
              <Code className="h-4 w-4" />
            </Button>
          </div>

          {/* HTML Tags */}
          <div className="flex items-center gap-1 border-r pr-2 mr-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => wrapSelectedText("<b>", "</b>")}
              className="h-8 px-2 text-xs font-bold"
              data-testid="button-html-bold"
              title="HTML Bold Tag"
            >
              &lt;b&gt;
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => wrapSelectedText("<i>", "</i>")}
              className="h-8 px-2 text-xs italic"
              data-testid="button-html-italic"
              title="HTML Italic Tag"
            >
              &lt;i&gt;
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => wrapSelectedText("<code>", "</code>")}
              className="h-8 px-2 text-xs font-mono"
              data-testid="button-html-code"
              title="HTML Code Tag"
            >
              &lt;code&gt;
            </Button>
          </div>

          {/* Emoji picker */}
          <div className="border-r pr-2 mr-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  data-testid="button-emoji-picker"
                  title="Insert Emoji"
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" data-testid="emoji-picker">
                <div className="space-y-3">
                  {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium mb-2 text-muted-foreground">{category}</h4>
                      <div className="grid grid-cols-8 gap-1">
                        {emojis.map((emoji) => (
                          <Button
                            key={emoji}
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => insertEmoji(emoji)}
                            className="h-8 w-8 p-0 text-lg hover:bg-accent"
                            data-testid={`emoji-${emoji}`}
                          >
                            {emoji}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

        </div>

        {/* Editor Area */}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="border-0 resize-none focus-visible:ring-0 rounded-none"
            style={{ minHeight: `${minHeight}px` }}
            data-testid="rich-text-editor-textarea"
          />
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
            {value.length} chars
          </div>
        </div>

        {/* Help Text */}
        <div className="px-3 py-2 bg-muted/20 border-t text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-4">
            <span><strong>Bold:</strong> **text** or &lt;b&gt;text&lt;/b&gt;</span>
            <span><strong>Italic:</strong> *text* or &lt;i&gt;text&lt;/i&gt;</span>
            <span><strong>Code:</strong> `text` or &lt;code&gt;text&lt;/code&gt;</span>
            <span><strong>Variables:</strong> {"{variable}"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}