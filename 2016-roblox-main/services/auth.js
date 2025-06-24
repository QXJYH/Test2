import request from "../lib/request"
import { getFullUrl } from "../lib/request";

export const login = ({ username, password }) => {
  const formBody = new URLSearchParams({
    username,
    password,
    'g-recaptcha-response': '10000000-aaaa-bbbb-cccc-000000000001',
    'h-captcha-response': '10000000-aaaa-bbbb-cccc-000000000001',
    '__RequestVerificationToken': 'CfDJ8F77gqtXtapKq9k4x6IMVEFzCahTJuy-cdlWjGpTTAvE2MglwklIud-dPYG88x0XramQXywUBR7HJaaIEWkmV_pi2l8rAZPqtl_nEFIKIq7UyG3I9RmFioMdUNDrJ8RerYvD_AKhmvcGBxa_aaJBjK0'
  }).toString();

  return request('POST', '/auth/login', formBody, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });
};


export const logout = () => {
  return request('POST', getFullUrl('auth', '/v2/logout'), {});
}

export const changePassword = ({ existingPassword, newPassword }) => {
  return request('POST', getFullUrl('auth', `/v2/user/passwords/change`), {
    currentPassword: existingPassword,
    newPassword,
  });
}

export const validateUsername = ({ username, context }) => {
  return request('GET', getFullUrl('auth', `/v1/usernames/validate?username=${encodeURIComponent(username)}&context=${encodeURIComponent(context)}`)).then(d => d.data)
}

export const changeUsername = ({ username, password }) => {
  return request('POST', getFullUrl('auth', `/v1/username`), {
    username,
    password,
  })
}

export const logoutFromAllOtherSessions = () => {
  return request('POST', getFullUrl('auth', '/v2/logoutfromallsessionsandreauthenticate'))
}