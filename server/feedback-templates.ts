/**
 * Feedback Template Engine — zero AI credits, zero external APIs.
 *
 * Provides structured templates for common civic engagement actions:
 *   1. Bill / Ordinance Comment
 *   2. Zoning Case Comment
 *   3. Budget Priority Comment
 *   4. General Public Comment
 *
 * Each template has questions that map to {{placeholders}} in a letter template.
 * generateFeedbackLetter() fills in the placeholders from user answers.
 */

import type { FeedbackTemplate, GeneratedFeedback } from "@shared/schema";

export const feedbackTemplates: FeedbackTemplate[] = [
  {
    id: "bill-ordinance",
    name: "Bill / Ordinance Comment",
    description: "Submit a comment on a specific bill or ordinance being considered by a governing body.",
    category: "legislation",
    questions: [
      {
        id: "bill_number",
        label: "Bill or Ordinance Number",
        type: "text",
        placeholder: "e.g., Bill 2024-0123 or Ordinance 45",
        required: true,
      },
      {
        id: "governing_body",
        label: "Governing Body",
        type: "select",
        options: [
          "Pittsburgh City Council",
          "Allegheny County Council",
          "Pittsburgh Planning Commission",
          "Zoning Board of Adjustment",
          "Urban Redevelopment Authority",
          "Other",
        ],
        required: true,
      },
      {
        id: "position",
        label: "Your Position",
        type: "select",
        options: ["Support", "Oppose", "Request Amendment", "Need More Information"],
        required: true,
      },
      {
        id: "reason",
        label: "Why do you hold this position?",
        type: "textarea",
        placeholder: "Explain your reasoning, personal impact, or community concerns...",
        required: true,
      },
      {
        id: "neighborhood",
        label: "Your Neighborhood",
        type: "text",
        placeholder: "e.g., Squirrel Hill, Lawrenceville, Mt. Washington",
        required: false,
      },
      {
        id: "name",
        label: "Your Name",
        type: "text",
        placeholder: "Full name",
        required: true,
      },
    ],
    letterTemplate: `Dear Members of the {{governing_body}},

I am writing regarding {{bill_number}}.{{#neighborhood}} As a resident of {{neighborhood}},{{/neighborhood}} I would like to express my position: I {{position_verb}} this measure.

{{reason}}

I respectfully ask that you consider this feedback as you deliberate on {{bill_number}}. Thank you for your service to our community and for the opportunity to provide input.

Sincerely,
{{name}}{{#neighborhood}}
{{neighborhood}} resident{{/neighborhood}}`,
  },
  {
    id: "zoning-case",
    name: "Zoning Case Comment",
    description: "Comment on a zoning variance, conditional use, or special exception request.",
    category: "zoning",
    questions: [
      {
        id: "case_number",
        label: "Case or Application Number",
        type: "text",
        placeholder: "e.g., DCP-ZBA-2024-00123",
        required: true,
      },
      {
        id: "property_address",
        label: "Property Address",
        type: "text",
        placeholder: "Address of the property in question",
        required: true,
      },
      {
        id: "position",
        label: "Your Position",
        type: "select",
        options: ["Support", "Oppose", "Support with Conditions"],
        required: true,
      },
      {
        id: "impact",
        label: "How does this affect you or your neighborhood?",
        type: "textarea",
        placeholder: "Describe the impact on traffic, parking, noise, property values, character of neighborhood...",
        required: true,
      },
      {
        id: "conditions",
        label: "Conditions or modifications you'd like to see (if any)",
        type: "textarea",
        placeholder: "e.g., limited hours of operation, additional screening, parking requirements...",
        required: false,
      },
      {
        id: "name",
        label: "Your Name",
        type: "text",
        placeholder: "Full name",
        required: true,
      },
      {
        id: "address",
        label: "Your Address",
        type: "text",
        placeholder: "Your home address (to demonstrate proximity)",
        required: false,
      },
    ],
    letterTemplate: `Dear Members of the Zoning Board of Adjustment,

I am writing to comment on Case {{case_number}} regarding the property at {{property_address}}.

I {{position_verb}} this application.

{{impact}}{{#conditions}}

I would request the following conditions or modifications:
{{conditions}}{{/conditions}}

Thank you for considering community input on this matter.

Sincerely,
{{name}}{{#address}}
{{address}}{{/address}}`,
  },
  {
    id: "budget-priority",
    name: "Budget Priority Comment",
    description: "Share your priorities for the city or county budget process.",
    category: "budget",
    questions: [
      {
        id: "budget_body",
        label: "Which budget?",
        type: "select",
        options: [
          "City of Pittsburgh",
          "Allegheny County",
          "Pittsburgh Public Schools",
          "Pittsburgh Water & Sewer Authority",
        ],
        required: true,
      },
      {
        id: "priority_area",
        label: "Priority Area",
        type: "select",
        options: [
          "Public Safety",
          "Infrastructure & Roads",
          "Parks & Recreation",
          "Housing & Affordability",
          "Transit & Transportation",
          "Education",
          "Environmental & Sustainability",
          "Economic Development",
          "Health & Human Services",
          "Other",
        ],
        required: true,
      },
      {
        id: "specific_ask",
        label: "What specific investment or change would you like to see?",
        type: "textarea",
        placeholder: "Be specific about programs, projects, or funding levels...",
        required: true,
      },
      {
        id: "why_matters",
        label: "Why does this matter to you and your community?",
        type: "textarea",
        placeholder: "Personal experience, community need, data you've seen...",
        required: true,
      },
      {
        id: "neighborhood",
        label: "Your Neighborhood",
        type: "text",
        placeholder: "e.g., East Liberty, Brookline, North Side",
        required: false,
      },
      {
        id: "name",
        label: "Your Name",
        type: "text",
        placeholder: "Full name",
        required: true,
      },
    ],
    letterTemplate: `Dear {{budget_body}} Budget Officials,

I am writing to share my priorities for the upcoming budget.{{#neighborhood}} As a resident of {{neighborhood}},{{/neighborhood}} I urge you to prioritize investment in {{priority_area}}.

Specifically, I would like to see:
{{specific_ask}}

This matters because:
{{why_matters}}

Thank you for the opportunity to participate in the budget process and for considering community priorities in your decisions.

Sincerely,
{{name}}{{#neighborhood}}
{{neighborhood}} resident{{/neighborhood}}`,
  },
  {
    id: "general-comment",
    name: "General Public Comment",
    description: "Submit a general comment to a governing body on any topic.",
    category: "general",
    questions: [
      {
        id: "governing_body",
        label: "Governing Body or Agency",
        type: "select",
        options: [
          "Pittsburgh City Council",
          "Allegheny County Council",
          "Pittsburgh Planning Commission",
          "Urban Redevelopment Authority",
          "Pittsburgh Public Schools Board",
          "Pittsburgh Regional Transit",
          "PWSA Board",
          "Other",
        ],
        required: true,
      },
      {
        id: "topic",
        label: "Topic",
        type: "text",
        placeholder: "Brief topic or subject line",
        required: true,
      },
      {
        id: "comment",
        label: "Your Comment",
        type: "textarea",
        placeholder: "Share your thoughts, concerns, or suggestions...",
        required: true,
      },
      {
        id: "action_requested",
        label: "What action would you like to see?",
        type: "textarea",
        placeholder: "What specific outcome are you hoping for?",
        required: false,
      },
      {
        id: "neighborhood",
        label: "Your Neighborhood",
        type: "text",
        placeholder: "e.g., Highland Park, South Side, Homewood",
        required: false,
      },
      {
        id: "name",
        label: "Your Name",
        type: "text",
        placeholder: "Full name",
        required: true,
      },
    ],
    letterTemplate: `Dear Members of the {{governing_body}},

I am writing to share my thoughts regarding {{topic}}.{{#neighborhood}} As a resident of {{neighborhood}},{{/neighborhood}} this issue is important to me.

{{comment}}{{#action_requested}}

I would respectfully request the following:
{{action_requested}}{{/action_requested}}

Thank you for your service and for considering community input.

Sincerely,
{{name}}{{#neighborhood}}
{{neighborhood}} resident{{/neighborhood}}`,
  },
];

/**
 * Get all feedback templates.
 */
export function getTemplates(): FeedbackTemplate[] {
  return feedbackTemplates;
}

/**
 * Get a single template by ID.
 */
export function getTemplateById(id: string): FeedbackTemplate | undefined {
  return feedbackTemplates.find((t) => t.id === id);
}

/**
 * Generate a feedback letter from a template and user answers.
 * Handles:
 *   - {{placeholder}} — simple substitution
 *   - {{#field}}...{{/field}} — conditional block (included only if field has a value)
 *   - position → position_verb mapping ("Support" → "support", "Oppose" → "oppose", etc.)
 */
export function generateFeedbackLetter(
  templateId: string,
  answers: Record<string, string>
): GeneratedFeedback {
  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template "${templateId}" not found`);
  }

  // Build the expanded answers with computed fields
  const expanded: Record<string, string> = { ...answers };

  // Map position to verb form
  if (expanded.position) {
    const posMap: Record<string, string> = {
      "Support": "support",
      "Oppose": "oppose",
      "Request Amendment": "request amendments to",
      "Need More Information": "request more information about",
      "Support with Conditions": "support with conditions",
    };
    expanded.position_verb = posMap[expanded.position] || expanded.position.toLowerCase();
  }

  let body = template.letterTemplate;

  // Process conditional blocks: {{#field}}...{{/field}}
  body = body.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, field, content) => {
    const val = expanded[field];
    if (val && val.trim()) {
      // Replace any placeholders inside the conditional block
      return content.replace(/\{\{(\w+)\}\}/g, (_m: string, key: string) => expanded[key] || "");
    }
    return "";
  });

  // Process remaining simple placeholders
  body = body.replace(/\{\{(\w+)\}\}/g, (_match, key) => expanded[key] || `[${key}]`);

  // Clean up extra blank lines
  body = body.replace(/\n{3,}/g, "\n\n").trim();

  // Generate subject line
  const subject = buildSubject(template, expanded);

  return {
    subject,
    body,
    templateId,
    generatedAt: new Date().toISOString(),
  };
}

function buildSubject(template: FeedbackTemplate, answers: Record<string, string>): string {
  switch (template.id) {
    case "bill-ordinance":
      return `Public Comment: ${answers.position || "Comment"} on ${answers.bill_number || "Legislation"}`;
    case "zoning-case":
      return `Zoning Comment: Case ${answers.case_number || ""} — ${answers.property_address || ""}`;
    case "budget-priority":
      return `Budget Comment: ${answers.priority_area || "Budget Priorities"}`;
    case "general-comment":
      return `Public Comment: ${answers.topic || "General Comment"}`;
    default:
      return `Public Comment — ${template.name}`;
  }
}
