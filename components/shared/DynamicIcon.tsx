import * as Icons from 'lucide-react';
import { LucideProps } from 'lucide-react';
import React from 'react';

interface DynamicIconProps extends Omit<LucideProps, 'ref'> {
    name: string;
}

const DynamicIcon: React.FC<DynamicIconProps> = ({ name, ...props }) => {
    // Access the icon from the Icons namespace
    // We need to cast to any because accessing properties dynamically on the namespace
    // isn't strictly typed in the way we need for this
    const IconComponent = (Icons as any)[name];

    if (!IconComponent) {
        // Fallback or return null if icon doesn't exist
        return null;
    }

    return <IconComponent {...props} />;
};

export default DynamicIcon;
