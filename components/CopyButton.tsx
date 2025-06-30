import React, { useState, useCallback } from 'react';
import IconButton from './IconButton';
import { ClipboardIcon, CheckIcon } from './Icons';

interface CopyButtonProps {
    text: string | null | undefined;
    ariaLabel: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ text, ariaLabel }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        if (!text || isCopied) {
            return;
        }

        if (!navigator.clipboard) {
            console.error('Clipboard API not supported');
            alert("Clipboard functionality is not supported in your browser.");
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000); // Reset icon after 2 seconds
        } catch (err) {
            console.error('Failed to copy text: ', err);
            // This will catch the "Document is not focused" error and inform the user.
            alert("Could not copy to clipboard. Your browser might have blocked it. Please try again.");
        }
    }, [text, isCopied]);

    return (
        <IconButton onClick={handleCopy} ariaLabel={ariaLabel} disabled={!text}>
            {isCopied ? <CheckIcon className="h-4 w-4 text-emerald-500" /> : <ClipboardIcon />}
        </IconButton>
    );
};

export default CopyButton;
