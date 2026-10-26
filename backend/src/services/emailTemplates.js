/**
 * Professional, Responsive HTML & Text Email Templates for VISTA AI Travel Planner
 * 
 * Features:
 * - HTML Injection Defense (escapeHtml on all dynamic fields)
 * - VISTA Terracotta & Cream Luxury Travel Design System
 * - Email client compatibility (Gmail, Outlook, Apple Mail, iOS/Android)
 * - Plain-text alternatives for accessibility and non-HTML clients
 */

const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatCurrencyINR = (amount) => {
  const num = Number(amount) || 0;
  return '₹' + Math.round(num).toLocaleString('en-IN');
};

/**
 * Base email layout wrapper with VISTA branding and responsive typography
 */
const renderBaseLayout = ({ title, preheader, contentHtml, disclaimerText = '' }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #f7f3ed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
    .email-container { max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e7ded4; box-shadow: 0 4px 18px rgba(100, 70, 40, 0.06); }
    @media only screen and (max-width: 640px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .content-padding { padding: 24px 18px !important; }
      .header-padding { padding: 28px 18px !important; }
      .grid-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f7f3ed;">
  <!-- Preheader preview text -->
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #f7f3ed;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding: 10px;">
        <table role="presentation" class="email-container" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; background-color: #ffffff; border-radius: 14px; border: 1px solid #e8dfd5;">
          
          <!-- Brand Header -->
          <tr>
            <td class="header-padding" align="center" style="padding: 32px 30px; background: linear-gradient(135deg, #c26d38 0%, #d97736 50%, #8c4118 100%);">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <span style="display: inline-block; padding: 6px 14px; background: rgba(255, 255, 255, 0.18); border-radius: 20px; color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;">
                      VISTA AI TRAVEL
                    </span>
                    <h1 style="margin: 10px 0 4px 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">
                      ${escapeHtml(title)}
                    </h1>
                    <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 13px;">
                      Intelligent Route & Real-Time Cost Engine
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td class="content-padding" style="padding: 36px 34px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 30px; background-color: #faf6f0; border-top: 1px solid #ede4da; text-align: center; color: #64748b; font-size: 12px; line-height: 1.6;">
              <p style="margin: 0 0 8px 0; font-weight: 700; color: #475569;">
                VISTA AI Travel Planner &bull; Transparent Real-World Travel Cost Estimations
              </p>
              ${disclaimerText ? `<p style="margin: 0 0 10px 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">${escapeHtml(disclaimerText)}</p>` : ''}
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                This transactional email was sent to your account via Brevo. If you have questions, contact us at support@vistatravel.app.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * 1. Email Verification Template
 */
const getVerificationEmailTemplate = (optsOrName, maybeCode, maybeLink) => {
  const isObj = optsOrName && typeof optsOrName === 'object';
  const name = isObj ? optsOrName.name : optsOrName;
  const verificationCode = isObj ? optsOrName.verificationCode : maybeCode;
  const verificationLink = isObj ? optsOrName.verificationLink : maybeLink;

  const safeName = escapeHtml(name || 'Traveler');
  const safeCode = escapeHtml(verificationCode);
  const safeLink = escapeHtml(verificationLink);

  const contentHtml = `
    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a; font-weight: 700;">
      Welcome to VISTA, ${safeName}!
    </h2>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
      Thank you for creating an account. Please verify your email address to activate your account, save personalized itineraries, and access route cost calculations.
    </p>

    <!-- Verification Code Box -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center" style="background-color: #fdfaf6; border: 2px dashed #d97736; border-radius: 10px; padding: 22px;">
          <span style="font-size: 12px; font-weight: 700; color: #8c4118; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 6px;">
            Your 6-Digit Verification Code
          </span>
          <span style="font-size: 32px; font-weight: 900; letter-spacing: 0.25em; color: #c26d38; font-family: 'Courier New', Courier, monospace;">
            ${safeCode}
          </span>
          <span style="display: block; font-size: 12px; color: #64748b; margin-top: 8px;">
            Valid for <strong>15 minutes</strong> &bull; Single-use only
          </span>
        </td>
      </tr>
    </table>

    ${verificationLink ? `
    <p style="text-align: center; margin: 26px 0 16px 0;">
      <a href="${safeLink}" style="display: inline-block; background: linear-gradient(135deg, #c26d38 0%, #d97736 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 25px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(194, 109, 56, 0.3);">
        Verify Email Instantly
      </a>
    </p>
    ` : ''}

    <p style="margin: 22px 0 0 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
      If you did not register for a VISTA Travel account, please disregard this email. No changes will be made to your email.
    </p>
  `;

  const textContent = `
Welcome to VISTA AI Travel Planner, ${name || 'Traveler'}!

Your 6-Digit Email Verification Code: ${verificationCode}
This code will expire in 15 minutes.

${verificationLink ? `Or click the link to verify: ${verificationLink}\n` : ''}
If you did not sign up for VISTA, please disregard this email.
`;

  return {
    subject: 'Verify Your VISTA Travel Account',
    html: renderBaseLayout({
      title: 'Verify Your Email Address',
      preheader: `Your verification code is ${verificationCode}. Complete your registration on VISTA.`,
      contentHtml
    }),
    text: textContent.trim()
  };
};

/**
 * 2. Password Reset OTP Template
 */
const getPasswordResetOtpTemplate = (optsOrName, maybeCode, maybeEmail) => {
  const isObj = optsOrName && typeof optsOrName === 'object';
  const name = isObj ? optsOrName.name : optsOrName;
  const otpCode = isObj ? optsOrName.otpCode : maybeCode;
  const email = isObj ? (optsOrName.email || '') : (maybeEmail || '');

  const safeName = escapeHtml(name || 'Traveler');
  const safeOtp = escapeHtml(otpCode);

  const contentHtml = `
    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a; font-weight: 700;">
      Password Reset Request
    </h2>
    <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.6; color: #475569;">
      Hello ${safeName}, we received a request to reset the password for your VISTA Travel account (${escapeHtml(email)}).
    </p>

    <!-- OTP Box -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center" style="background-color: #fff7ed; border: 2px solid #ea580c; border-radius: 10px; padding: 22px;">
          <span style="font-size: 12px; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 6px;">
            Password Reset One-Time Password (OTP)
          </span>
          <span style="font-size: 34px; font-weight: 900; letter-spacing: 0.25em; color: #ea580c; font-family: 'Courier New', Courier, monospace;">
            ${safeOtp}
          </span>
          <span style="display: block; font-size: 12px; color: #64748b; margin-top: 8px;">
            Expires in <strong>10 minutes</strong> &bull; Do not share this code with anyone
          </span>
        </td>
      </tr>
    </table>

    <div style="background-color: #f8fafc; border-left: 4px solid #cbd5e1; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">
        <strong>Security Notice:</strong> VISTA staff will never ask you for your verification code or password. If you did not request a password reset, please change your credentials immediately or contact support@vistatravel.app.
      </p>
    </div>
  `;

  const textContent = `
VISTA Travel - Password Reset Request

Hello ${name || 'Traveler'},
Your 6-Digit Password Reset OTP is: ${otpCode}

This code expires in 10 minutes and is single-use only.
If you did not request this password reset, please ignore this email.
`;

  return {
    subject: 'Your Password Reset Verification Code',
    html: renderBaseLayout({
      title: 'Reset Your Password',
      preheader: `Your password reset code is ${otpCode}. Valid for 10 minutes.`,
      contentHtml
    }),
    text: textContent.trim()
  };
};

/**
 * 3. Password Changed Confirmation Template
 */
const getPasswordChangedTemplate = (optsOrName, maybeEmail, maybeTime) => {
  const isObj = optsOrName && typeof optsOrName === 'object';
  const name = isObj ? optsOrName.name : optsOrName;
  const email = isObj ? optsOrName.email : (maybeEmail || '');
  const timestamp = isObj ? optsOrName.timestamp : (maybeTime || new Date().toUTCString());

  const safeName = escapeHtml(name || 'Traveler');
  const safeTime = escapeHtml(timestamp);

  const contentHtml = `
    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a; font-weight: 700;">
      Password Successfully Changed
    </h2>
    <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.6; color: #475569;">
      Hello ${safeName}, this is a confirmation that your VISTA Travel password was successfully changed on <strong>${safeTime}</strong>.
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.5;">
        <strong>Active Sessions Cleared:</strong> All prior active session tokens have been safely revoked. You can log in with your new password on any device.
      </p>
    </div>

    <p style="margin: 18px 0 0 0; font-size: 13px; color: #dc2626; line-height: 1.5;">
      <strong>Did not request this change?</strong> Please contact our security response team immediately at 
      <a href="mailto:support@vistatravel.app" style="color: #dc2626; font-weight: 700;">support@vistatravel.app</a> to secure your account.
    </p>
  `;

  const textContent = `
VISTA Travel - Password Changed Confirmation

Hello ${name || 'Traveler'},
Your account password was successfully updated on ${timestamp || new Date().toISOString()}.
All prior active sessions have been invalidated.

If you did not perform this change, contact support@vistatravel.app immediately.
`;

  return {
    subject: 'Your Password Has Been Changed',
    html: renderBaseLayout({
      title: 'Security Alert: Password Updated',
      preheader: 'Your VISTA Travel account password has been updated.',
      contentHtml
    }),
    text: textContent.trim()
  };
};

/**
 * 4. Complete Travel Plan Delivery Template
 */
const getItineraryEmailTemplate = ({ name, email, itinerary, appBaseUrl = 'http://localhost:3000' }) => {
  const safeName = escapeHtml(name || 'Traveler');
  const summary = itinerary.summary || {};
  const details = itinerary.details || {};
  const costs = itinerary.estimatedCosts || {};
  const dayPlans = Array.isArray(itinerary.dayPlans) ? itinerary.dayPlans : [];
  const destination = summary.destination || itinerary.destination || 'Your Destination';
  const startLocation = summary.startLocation || itinerary.startLocation || 'Your Origin';
  const totalDays = summary.totalDays || itinerary.totalDays || dayPlans.length || 3;
  const companionType = itinerary.travelCompanionType || summary.travelCompanionType || 'solo';
  const numberOfTravelers = itinerary.numberOfTravelers || summary.numberOfTravelers || 1;
  const transportMode = details.transportMode || itinerary.transport || 'car';
  const totalCost = costs.total || itinerary.estimatedCost || 0;
  const perPersonCost = Math.round(totalCost / Math.max(1, numberOfTravelers));

  // Build Day-by-Day schedule HTML
  const dayPlansHtml = dayPlans.map((day, idx) => {
    const dayNum = day.day || (idx + 1);
    const dayTheme = escapeHtml(day.theme || day.title || `Day ${dayNum} Exploration`);
    const dayActivities = Array.isArray(day.activities) ? day.activities : [];
    const overnightStay = escapeHtml(day.overnightStay || day.stay || 'Recommended local hotel / homestay');
    const meals = escapeHtml(day.meals || day.food || 'Local dining & cafes');

    const activitiesHtml = dayActivities.map(act => {
      const actName = typeof act === 'string' ? act : (act.activity || act.place || act.name || 'Sightseeing stop');
      const actTime = act.time ? `<span style="color: #c26d38; font-weight: 700; font-size: 11px; margin-right: 6px;">${escapeHtml(act.time)}</span>` : '';
      const actDuration = act.duration ? `<span style="color: #64748b; font-size: 11px;">(${escapeHtml(act.duration)})</span>` : '';
      const mapQuery = encodeURIComponent(`${actName} ${destination}`);
      const mapLink = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

      return `
        <li style="margin-bottom: 8px; font-size: 13px; line-height: 1.5; color: #334155;">
          ${actTime}
          <strong>${escapeHtml(actName)}</strong> ${actDuration}
          <a href="${mapLink}" target="_blank" style="margin-left: 6px; font-size: 11px; color: #0284c7; text-decoration: none;">&bull; View on Map &rarr;</a>
        </li>
      `;
    }).join('');

    return `
      <div style="margin-bottom: 18px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #f8fafc; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
          <span style="font-weight: 800; color: #c26d38; font-size: 13px; text-transform: uppercase;">Day ${dayNum}</span>
          <span style="font-weight: 600; color: #1e293b; font-size: 13px;">${dayTheme}</span>
        </div>
        <div style="padding: 14px 16px;">
          ${activitiesHtml ? `<ul style="margin: 0 0 12px 0; padding-left: 18px;">${activitiesHtml}</ul>` : '<p style="margin: 0; font-size: 13px; color: #64748b;">Scenic exploration and local leisure.</p>'}
          <div style="font-size: 12px; color: #64748b; border-top: 1px dashed #f1f5f9; padding-top: 8px; margin-top: 8px;">
            <span><strong>Meals:</strong> ${meals}</span><br>
            <span><strong>Stay:</strong> ${overnightStay}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const disclaimer = 'All trip costs, NHAI FASTag toll rates, state fuel tariffs, and stay prices are estimated based on verifiable public benchmarks. Live rates and seasonal tariffs may vary. Booking links provide direct provider access where available.';

  const contentHtml = `
    <h2 style="margin: 0 0 6px 0; font-size: 20px; color: #0f172a; font-weight: 800;">
      Your Travel Expedition to ${escapeHtml(destination)}
    </h2>
    <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b;">
      Crafted exclusively for ${safeName} by VISTA Route & Cost Intelligence Engine.
    </p>

    <!-- Trip Overview Card -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background-color: #fdfaf6; border: 1px solid #ebd9c8; border-radius: 10px;">
      <tr>
        <td style="padding: 18px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #475569; width: 50%;">
                <strong>Origin:</strong> ${escapeHtml(startLocation)}
              </td>
              <td style="padding: 6px 0; font-size: 13px; color: #475569; width: 50%;">
                <strong>Destination:</strong> ${escapeHtml(destination)}
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #475569;">
                <strong>Duration:</strong> ${totalDays} Days
              </td>
              <td style="padding: 6px 0; font-size: 13px; color: #475569;">
                <strong>Travelers:</strong> ${numberOfTravelers} (${escapeHtml(companionType)})
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #475569;">
                <strong>Transport Mode:</strong> ${escapeHtml(transportMode.toUpperCase())}
              </td>
              <td style="padding: 6px 0; font-size: 13px; color: #475569;">
                <strong>Total Estimate:</strong> <span style="color: #c26d38; font-weight: 800;">${formatCurrencyINR(totalCost)}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Real-World Cost Breakdown Table -->
    <h3 style="margin: 24px 0 12px 0; font-size: 15px; color: #0f172a; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px;">
      Verified Trip Cost Breakdown
    </h3>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background-color: #f8fafc; color: #475569; text-align: left; border-bottom: 1px solid #cbd5e1;">
          <th style="padding: 8px 12px;">Category</th>
          <th style="padding: 8px 12px;">Benchmark Basis</th>
          <th style="padding: 8px 12px; text-align: right;">Estimated Cost</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 12px; font-weight: 600;">Fuel / EV Energy</td>
          <td style="padding: 8px 12px; color: #64748b;">IOCL / State retail tariffs</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: 600;">${formatCurrencyINR(costs.fuel || 0)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 12px; font-weight: 600;">FASTag Highway Tolls</td>
          <td style="padding: 8px 12px; color: #64748b;">NHAI corridor schedules</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: 600;">${formatCurrencyINR(costs.toll || costs.tolls || 0)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 12px; font-weight: 600;">Accommodation</td>
          <td style="padding: 8px 12px; color: #64748b;">Verified regional medians</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: 600;">${formatCurrencyINR(costs.accommodation || 0)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 12px; font-weight: 600;">Meals & Dining</td>
          <td style="padding: 8px 12px; color: #64748b;">Regional dining index</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: 600;">${formatCurrencyINR(costs.food || 0)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 12px; font-weight: 600;">Activities & Sightseeing</td>
          <td style="padding: 8px 12px; color: #64748b;">Official entry & permit fees</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: 600;">${formatCurrencyINR(costs.activities || 0)}</td>
        </tr>
        <tr style="background-color: #fdfaf6; font-weight: 800; border-top: 2px solid #e2e8f0;">
          <td style="padding: 10px 12px; color: #0f172a;">Total Estimated Trip Cost</td>
          <td style="padding: 10px 12px; color: #64748b;">${formatCurrencyINR(perPersonCost)} / traveler</td>
          <td style="padding: 10px 12px; text-align: right; color: #c26d38; font-size: 15px;">${formatCurrencyINR(totalCost)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Day by Day Itinerary -->
    <h3 style="margin: 28px 0 14px 0; font-size: 15px; color: #0f172a; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px;">
      Day-by-Day Schedule & Route Stops
    </h3>
    ${dayPlansHtml}

    <!-- Call to action -->
    <div style="text-align: center; margin: 32px 0 16px 0;">
      <a href="${escapeHtml(appBaseUrl)}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #c26d38 0%, #d97736 100%); color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 25px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px rgba(194, 109, 56, 0.35);">
        Open Plan in VISTA Web App &rarr;
      </a>
    </div>
  `;

  const textContent = `
============================================================
VISTA AI TRAVEL PLANNER - YOUR TRAVEL EXPEDITION
============================================================
Destination: ${destination}
From: ${startLocation}
Duration: ${totalDays} Days
Travelers: ${numberOfTravelers} (${companionType})
Transport: ${transportMode}
Total Estimated Cost: ${formatCurrencyINR(totalCost)} (${formatCurrencyINR(perPersonCost)} per traveler)

COST BREAKDOWN:
- Fuel / Energy: ${formatCurrencyINR(costs.fuel || 0)}
- Tolls: ${formatCurrencyINR(costs.toll || costs.tolls || 0)}
- Lodging: ${formatCurrencyINR(costs.accommodation || 0)}
- Meals: ${formatCurrencyINR(costs.food || 0)}
- Activities: ${formatCurrencyINR(costs.activities || 0)}

SCHEDULE:
${dayPlans.map(d => `Day ${d.day || 1}: ${d.theme || d.title || ''}\nStay: ${d.overnightStay || 'Local Hotel'}\n`).join('\n')}

DISCLAIMER:
${disclaimer}

View full interactive map & itinerary at: ${appBaseUrl}
`;

  return {
    subject: `Your Travel Plan for ${destination} - VISTA AI Planner`,
    html: renderBaseLayout({
      title: `${destination} Expedition`,
      preheader: `Your ${totalDays}-day travel plan to ${destination} is ready. Total estimated cost: ${formatCurrencyINR(totalCost)}.`,
      contentHtml,
      disclaimerText: disclaimer
    }),
    text: textContent.trim()
  };
};

module.exports = {
  escapeHtml,
  renderBaseLayout,
  getVerificationEmailTemplate,
  getPasswordResetOtpTemplate,
  getPasswordChangedTemplate,
  getItineraryEmailTemplate
};
