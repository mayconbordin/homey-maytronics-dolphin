# Maytronics Dolphin

Adds support for Maytronics Dolphin range pool cleaners with the MyDolphin Plus app.

## Setup

1. Add your robot to your account in the MyDolphin Plus app.
2. In Homey, add a Dolphin Pool Cleaner device and enter the email address you use for the MyDolphin Plus app.
3. Enter the sign-in code Maytronics emails you.

Maytronics asks you to sign in again with a new code about once a year. When that happens the device becomes unavailable; open the device in Homey and choose **Repair** to sign in again.

### Upgrading from 1.0.x

Earlier versions signed in with an email and password, which Maytronics no longer supports. Existing devices show as unavailable after the upgrade: choose **Repair** on the device and sign in with an emailed code. Your flows keep working.
