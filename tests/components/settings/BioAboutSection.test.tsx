/**
 * @vitest-environment jsdom
 * BioAboutSection Component Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BioAboutSection } from '@/components/settings/BioAboutSection';
import { Api } from '@/services/api';

// Mock API
vi.mock('@/services/api', () => ({
    Api: {
        get: vi.fn(),
        put: vi.fn()
    }
}));

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback: string) => fallback
    })
}));

const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe'
};

const mockBioData = {
    bio: {
        shortBio: 'Software Engineer',
        longBio: 'Experienced developer with passion for clean code.',
        skills: ['JavaScript', 'TypeScript', 'React'],
        yearsExperience: 5
    }
};

describe('BioAboutSection Component', () => {
    const user = userEvent.setup();
    const mockOnUpdate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue(mockBioData);
        (Api.put as any).mockResolvedValue({});
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Rendering', () => {
        it('renders the section title', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Bio & About')).toBeInTheDocument();
            });
        });

        it('renders short bio section', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Short Bio')).toBeInTheDocument();
            });
        });

        it('renders about me section', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('About Me')).toBeInTheDocument();
            });
        });

        it('renders skills section', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Skills & Expertise')).toBeInTheDocument();
            });
        });

        it('renders experience section', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Experience')).toBeInTheDocument();
            });
        });

        it('renders save button', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });
        });
    });

    describe('Data Loading', () => {
        it('loads bio data on mount', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(Api.get).toHaveBeenCalledWith('/profile/bio');
            });
        });

        it('displays loaded short bio', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                const input = screen.getByPlaceholderText('A brief one-liner about yourself...');
                expect(input).toHaveValue('Software Engineer');
            });
        });

        it('displays loaded skills as tags', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('JavaScript')).toBeInTheDocument();
                expect(screen.getByText('TypeScript')).toBeInTheDocument();
                expect(screen.getByText('React')).toBeInTheDocument();
            });
        });
    });

    describe('Form Interactions', () => {
        it('updates short bio when typed', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByPlaceholderText('A brief one-liner about yourself...')).toBeInTheDocument();
            });

            const input = screen.getByPlaceholderText('A brief one-liner about yourself...');
            await user.clear(input);
            await user.type(input, 'New bio text');

            expect(input).toHaveValue('New bio text');
        });

        it('shows character count for short bio', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('17/150')).toBeInTheDocument(); // 'Software Engineer' length
            });
        });

        it('adds a new skill when typing and pressing enter', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Add a skill...')).toBeInTheDocument();
            });

            const skillInput = screen.getByPlaceholderText('Add a skill...');
            await user.type(skillInput, 'Python{enter}');

            await waitFor(() => {
                expect(screen.getByText('Python')).toBeInTheDocument();
            });
        });

        it('removes skill when X button clicked', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('JavaScript')).toBeInTheDocument();
            });

            // Find the remove button for JavaScript skill
            const skillTag = screen.getByText('JavaScript').closest('span');
            const removeButton = skillTag?.querySelector('button');
            
            if (removeButton) {
                await user.click(removeButton);
            }

            await waitFor(() => {
                expect(screen.queryByText('JavaScript')).not.toBeInTheDocument();
            });
        });
    });

    describe('Skill Suggestions', () => {
        it('shows skill suggestions when input focused', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Add a skill...')).toBeInTheDocument();
            });

            const skillInput = screen.getByPlaceholderText('Add a skill...');
            await user.click(skillInput);
            await user.type(skillInput, 'Pro');

            // Should show suggestions matching 'Pro'
            await waitFor(() => {
                expect(screen.getByText('Project Management')).toBeInTheDocument();
            });
        });

        it('adds suggested skill when clicked', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Add a skill...')).toBeInTheDocument();
            });

            const skillInput = screen.getByPlaceholderText('Add a skill...');
            await user.click(skillInput);
            await user.type(skillInput, 'Leader');

            await waitFor(() => {
                expect(screen.getByText('Leadership')).toBeInTheDocument();
            });
            
            const suggestion = screen.getByText('Leadership');
            await user.click(suggestion);

            await waitFor(() => {
                // Leadership should now appear as a tag
                const skillTags = document.querySelectorAll('.rounded-full');
                expect(skillTags.length).toBeGreaterThan(3);
            });
        });
    });

    describe('Form Submission', () => {
        it('calls API on save', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(Api.put).toHaveBeenCalledWith('/profile/bio', expect.objectContaining({
                    shortBio: 'Software Engineer',
                    longBio: 'Experienced developer with passion for clean code.',
                    skills: ['JavaScript', 'TypeScript', 'React']
                }));
            });
        });

        it('shows saving state while submitting', async () => {
            (Api.put as any).mockImplementation(() => new Promise(() => {}));

            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(screen.getByText('Saving...')).toBeInTheDocument();
            });
        });

        it('calls onUpdate callback after successful save', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(mockOnUpdate).toHaveBeenCalled();
            });
        });

        it('shows success toast after save', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(screen.getByText('Saved!')).toBeInTheDocument();
            });
        });
    });

    describe('Empty State', () => {
        it('shows no skills message when skills array is empty', async () => {
            (Api.get as any).mockResolvedValue({ bio: { ...mockBioData.bio, skills: [] } });

            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('No skills added yet')).toBeInTheDocument();
            });
        });
    });

    describe('Tip Card', () => {
        it('renders profile tip', async () => {
            render(<BioAboutSection currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Profile Tip')).toBeInTheDocument();
            });
        });
    });
});

