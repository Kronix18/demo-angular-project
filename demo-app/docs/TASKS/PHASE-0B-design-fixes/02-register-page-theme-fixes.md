# P0B-02 — Register Page Theme Fixes

## Scope
Only styling changes to `app/features/auth/register/register.component` and its template. No change to the form behavior or authentication logic.

## Issues Found

1. Button uses default Angular Material blue without hover effect; replaced with Stripe-style gradient.
2. Input fields use default MUI styling which lacks focus transition; added custom transitions.
3. Error states are red-only; added a subtle shake animation on form-submit-error.
4. Missing visual connection between "required" label and the input field.

## Deliverables to Produce

- `src/components/ui/auth/register-form/register-form.component.scss` — new component file containing only SCSS styles; no TS logic.
- Update template: replace `<button mat-raised-button color="primary">` with `<button class="btn-gradient">Register</button>`.
- Add CSS-only validation visual feedback (red border on invalid field), no JS dependencies.

## First Step — Write Tests

Test that changing the color palette variable in `_design-system.scss` does NOT change the submit button's click handler or form submission behavior. The behavior must be identical; only the background color changes.
