/**
 * SocialLinksSection - Manage user social links
 */

import { ExternalLink, Github, Linkedin, Twitter } from 'lucide-react';
import React from 'react';

interface SocialLinks {
  linkedin?: string;
  twitter?: string;
  github?: string;
  website?: string;
}

interface SocialLinksSectionProps {
  links?: SocialLinks;
  onUpdate?: (links: SocialLinks) => void;
  readOnly?: boolean;
  currentUser?: any;
}

export const SocialLinksSection: React.FC<SocialLinksSectionProps> = ({
  links: propLinks,
  onUpdate,
  readOnly = false,
  currentUser,
}) => {
  const links = propLinks || currentUser?.socialLinks || {};
  const handleChange = (key: keyof SocialLinks, value: string) => {
    if (onUpdate) {
      onUpdate({ ...links, [key]: value });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Social Links</h3>
      <div className="grid gap-4">
        <div className="flex items-center gap-3">
          <Linkedin className="w-5 h-5 text-blue-600" />
          <input
            type="url"
            value={links.linkedin || ''}
            onChange={(e) => handleChange('linkedin', e.target.value)}
            placeholder="LinkedIn URL"
            disabled={readOnly}
            className="flex-1 px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="flex items-center gap-3">
          <Twitter className="w-5 h-5 text-sky-500" />
          <input
            type="url"
            value={links.twitter || ''}
            onChange={(e) => handleChange('twitter', e.target.value)}
            placeholder="Twitter URL"
            disabled={readOnly}
            className="flex-1 px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="flex items-center gap-3">
          <Github className="w-5 h-5 text-c-text-secondary" />
          <input
            type="url"
            value={links.github || ''}
            onChange={(e) => handleChange('github', e.target.value)}
            placeholder="GitHub URL"
            disabled={readOnly}
            className="flex-1 px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="flex items-center gap-3">
          <ExternalLink className="w-5 h-5 text-c-accent" />
          <input
            type="url"
            value={links.website || ''}
            onChange={(e) => handleChange('website', e.target.value)}
            placeholder="Website URL"
            disabled={readOnly}
            className="flex-1 px-3 py-2 border rounded-lg"
          />
        </div>
      </div>
    </div>
  );
};

export default SocialLinksSection;
