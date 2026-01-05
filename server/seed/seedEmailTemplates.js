/**
 * Seed Email Templates
 * Default system email templates for Consultify platform
 */

import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_EMAIL_TEMPLATES = [
    {
        id: 'etpl-welcome-user',
        templateKey: 'welcome-user',
        name: 'Welcome New User',
        description: 'Sent when a new user registers or is invited to the platform',
        subject: 'Welcome to Consultify, {{firstName}}!',
        htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Welcome to Consultify</h1>
        </div>
        <div style="background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <p style="font-size: 18px; color: #1F2937; margin-bottom: 24px;">Hi <strong>{{firstName}}</strong>,</p>
            <p style="margin-bottom: 16px;">Welcome aboard! We're thrilled to have you join Consultify - your AI-powered consulting and project management platform.</p>
            <p style="margin-bottom: 24px;">Here's what you can do to get started:</p>
            <ul style="margin-bottom: 24px; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Complete your profile setup</li>
                <li style="margin-bottom: 8px;">Explore your dashboard</li>
                <li style="margin-bottom: 8px;">Connect with your team</li>
                <li style="margin-bottom: 8px;">Start your first project</li>
            </ul>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Get Started</a>
            </div>
            <p style="color: #6B7280; font-size: 14px; margin-top: 32px;">If you have any questions, our support team is here to help.</p>
            <p style="margin-top: 24px;">Best regards,<br><strong>The Consultify Team</strong></p>
        </div>
        <div style="text-align: center; padding: 24px; color: #9CA3AF; font-size: 12px;">
            <p style="margin: 0;">© 2025 Consultify. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
        textContent: `Welcome to Consultify, {{firstName}}!

Hi {{firstName}},

Welcome aboard! We're thrilled to have you join Consultify - your AI-powered consulting and project management platform.

Here's what you can do to get started:
- Complete your profile setup
- Explore your dashboard
- Connect with your team
- Start your first project

Get started at: {{loginUrl}}

If you have any questions, our support team is here to help.

Best regards,
The Consultify Team`,
        availableVariables: ['firstName', 'lastName', 'email', 'organizationName', 'loginUrl'],
        categoryId: 'cat_email_welcome',
        languageCode: 'en',
        status: 'PUBLISHED'
    },
    {
        id: 'etpl-password-reset',
        templateKey: 'password-reset',
        name: 'Password Reset Request',
        description: 'Sent when a user requests a password reset',
        subject: 'Reset Your Consultify Password',
        htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #1F2937; border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">🔐 Password Reset</h1>
        </div>
        <div style="background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <p style="font-size: 16px; color: #1F2937; margin-bottom: 24px;">Hi <strong>{{firstName}}</strong>,</p>
            <p style="margin-bottom: 16px;">We received a request to reset your password for your Consultify account.</p>
            <p style="margin-bottom: 24px;">Click the button below to reset your password. This link will expire in <strong>1 hour</strong>.</p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{{resetUrl}}" style="display: inline-block; background: #EF4444; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Reset Password</a>
            </div>
            <p style="color: #6B7280; font-size: 14px; margin-top: 24px;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">For security, this request was received from IP: {{ipAddress}}</p>
        </div>
        <div style="text-align: center; padding: 24px; color: #9CA3AF; font-size: 12px;">
            <p style="margin: 0;">© 2025 Consultify. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
        textContent: `Password Reset Request

Hi {{firstName}},

We received a request to reset your password for your Consultify account.

Click the link below to reset your password. This link will expire in 1 hour.

Reset Password: {{resetUrl}}

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

For security, this request was received from IP: {{ipAddress}}

The Consultify Team`,
        availableVariables: ['firstName', 'lastName', 'email', 'resetUrl', 'ipAddress', 'expirationTime'],
        categoryId: 'cat_email_security',
        languageCode: 'en',
        status: 'PUBLISHED'
    },
    {
        id: 'etpl-task-assigned',
        templateKey: 'task-assigned',
        name: 'Task Assignment Notification',
        description: 'Sent when a task is assigned to a user',
        subject: '📋 New Task Assigned: {{taskTitle}}',
        htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">New Task Assigned</h1>
        </div>
        <div style="background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <p style="font-size: 16px; color: #1F2937; margin-bottom: 24px;">Hi <strong>{{assigneeName}}</strong>,</p>
            <p style="margin-bottom: 24px;">You've been assigned a new task in project <strong>{{projectName}}</strong>:</p>
            <div style="background: #F3F4F6; border-left: 4px solid #10B981; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <h2 style="margin: 0 0 8px 0; color: #1F2937; font-size: 18px;">{{taskTitle}}</h2>
                <p style="margin: 0; color: #6B7280;">{{taskDescription}}</p>
            </div>
            <table style="width: 100%; margin-bottom: 24px;">
                <tr>
                    <td style="padding: 8px 0; color: #6B7280;">Priority:</td>
                    <td style="padding: 8px 0; font-weight: 600;">{{priority}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6B7280;">Due Date:</td>
                    <td style="padding: 8px 0; font-weight: 600;">{{dueDate}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6B7280;">Assigned By:</td>
                    <td style="padding: 8px 0; font-weight: 600;">{{assignerName}}</td>
                </tr>
            </table>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{{taskUrl}}" style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">View Task</a>
            </div>
        </div>
        <div style="text-align: center; padding: 24px; color: #9CA3AF; font-size: 12px;">
            <p style="margin: 0;">© 2025 Consultify. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
        textContent: `New Task Assigned: {{taskTitle}}

Hi {{assigneeName}},

You've been assigned a new task in project {{projectName}}:

Task: {{taskTitle}}
Description: {{taskDescription}}
Priority: {{priority}}
Due Date: {{dueDate}}
Assigned By: {{assignerName}}

View task at: {{taskUrl}}

The Consultify Team`,
        availableVariables: ['assigneeName', 'assignerName', 'projectName', 'taskTitle', 'taskDescription', 'priority', 'dueDate', 'taskUrl'],
        categoryId: 'cat_email_notifications',
        languageCode: 'en',
        status: 'PUBLISHED'
    },
    {
        id: 'etpl-report-ready',
        templateKey: 'report-ready',
        name: 'Report Ready for Review',
        description: 'Sent when a report is generated and ready for review',
        subject: '📊 Your Report is Ready: {{reportTitle}}',
        htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">📊 Report Ready</h1>
        </div>
        <div style="background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <p style="font-size: 16px; color: #1F2937; margin-bottom: 24px;">Hi <strong>{{recipientName}}</strong>,</p>
            <p style="margin-bottom: 24px;">Your report <strong>{{reportTitle}}</strong> is ready for review.</p>
            <div style="background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #92400E;"><strong>Report Type:</strong> {{reportType}}</p>
                <p style="margin: 8px 0 0 0; color: #92400E;"><strong>Generated:</strong> {{generatedAt}}</p>
            </div>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{{reportUrl}}" style="display: inline-block; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">View Report</a>
            </div>
        </div>
        <div style="text-align: center; padding: 24px; color: #9CA3AF; font-size: 12px;">
            <p style="margin: 0;">© 2025 Consultify. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
        textContent: `Your Report is Ready: {{reportTitle}}

Hi {{recipientName}},

Your report {{reportTitle}} is ready for review.

Report Type: {{reportType}}
Generated: {{generatedAt}}

View report at: {{reportUrl}}

The Consultify Team`,
        availableVariables: ['recipientName', 'reportTitle', 'reportType', 'generatedAt', 'reportUrl'],
        categoryId: 'cat_email_reports',
        languageCode: 'en',
        status: 'PUBLISHED'
    },
    {
        id: 'etpl-invitation',
        templateKey: 'invitation',
        name: 'Team Invitation',
        description: 'Sent when a user is invited to join an organization',
        subject: '🎉 You\'ve been invited to join {{organizationName}}',
        htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">🎉 You're Invited!</h1>
        </div>
        <div style="background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <p style="font-size: 16px; color: #1F2937; margin-bottom: 24px;">Hi there,</p>
            <p style="margin-bottom: 24px;"><strong>{{inviterName}}</strong> has invited you to join <strong>{{organizationName}}</strong> on Consultify.</p>
            <div style="background: #F3F4F6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #6B7280;"><strong>Your Role:</strong> {{role}}</p>
                <p style="margin: 8px 0 0 0; color: #6B7280;"><strong>Invitation expires:</strong> {{expirationDate}}</p>
            </div>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{{inviteUrl}}" style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Accept Invitation</a>
            </div>
            <p style="color: #6B7280; font-size: 14px; margin-top: 24px;">If you don't want to join, you can simply ignore this email.</p>
        </div>
        <div style="text-align: center; padding: 24px; color: #9CA3AF; font-size: 12px;">
            <p style="margin: 0;">© 2025 Consultify. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
        textContent: `You've been invited to join {{organizationName}}!

Hi there,

{{inviterName}} has invited you to join {{organizationName}} on Consultify.

Your Role: {{role}}
Invitation expires: {{expirationDate}}

Accept your invitation: {{inviteUrl}}

If you don't want to join, you can simply ignore this email.

The Consultify Team`,
        availableVariables: ['inviterName', 'organizationName', 'role', 'inviteUrl', 'expirationDate'],
        categoryId: 'cat_email_welcome',
        languageCode: 'en',
        status: 'PUBLISHED'
    }
];

async function seedEmailTemplates() {
    console.log('[Seed] Starting Email Templates seed...');

    const now = new Date().toISOString();

    for (const template of DEFAULT_EMAIL_TEMPLATES) {
        try {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR REPLACE INTO email_templates (
                        id, organization_id, template_key, name, description, subject,
                        html_content, text_content, available_variables, variables_schema,
                        version, status, category_id, language_code, is_active,
                        published_at, published_by, usage_count, created_at, updated_at
                    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, '{}', 1, ?, ?, ?, 1, ?, NULL, 0, ?, ?)`,
                    [
                        template.id,
                        template.templateKey,
                        template.name,
                        template.description,
                        template.subject,
                        template.htmlContent,
                        template.textContent,
                        JSON.stringify(template.availableVariables),
                        template.status,
                        template.categoryId,
                        template.languageCode,
                        template.status === 'PUBLISHED' ? now : null,
                        now,
                        now
                    ],
                    function(err) {
                        if (err) return reject(err);
                        console.log(`[Seed] Created/Updated email template: ${template.name}`);
                        resolve();
                    }
                );
            });
        } catch (err) {
            console.error(`[Seed] Error creating template ${template.name}:`, err.message);
        }
    }

    console.log('[Seed] Email Templates seed completed.');
}

// Run if executed directly
if (require.main === module) {
    seedEmailTemplates().then(() => {
        console.log('[Seed] Done.');
        process.exit(0);
    }).catch(err => {
        console.error('[Seed] Error:', err);
        process.exit(1);
    });
}

export {
seedEmailTemplates, DEFAULT_EMAIL_TEMPLATES
};

export default { seedEmailTemplates, DEFAULT_EMAIL_TEMPLATES };














