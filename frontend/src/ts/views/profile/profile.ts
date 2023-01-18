import { html } from 'lit';
import { msg, localized } from '@lit/localize';
import { customElement, property, state } from 'lit/decorators.js';
import ViewLayout from '../view';
import header from '../../data/header';
import { setLocale } from '../../utilities/language/language';
import { capitalize } from '../../utilities/text/text';
import { languages } from '../../data/langs';
import { until } from 'lit/directives/until.js';
import { client } from '../../data/misc';
import toast from '../../utilities/toast/toast';
import { repeat } from 'lit/directives/repeat.js';
import SlInput from '@shoelace-style/shoelace/dist/components/input/input';
import { imgs } from '../../data/fallbacks';
import avatarSize from '../../data/shared/avatarSizes';
import Rights from '../../data/shared/rights';
import { transRights, transRightsInfo } from '../../utilities/trans/trans';

const passwordMinLength = 8;
const passwordMaxLength = 35;
const maxLengthAbout = 560;
const activeMemberClass = 'team-member-active';

type Member = {
    _id: string;
    username: string;
    role: string;
    email: string;
    rights: Rights;
    about: string;
    avatar: string;
    member: string | undefined;
};
type Team = {
    _id: string;
    maxMembers: number;
    name: string;
    members: Member[];
};

const fallbackUser: Member = {
    _id: '',
    username: '',
    role: '',
    rights: {
        _id: '',
        addTeamMember: false,
        changeTeamMemberRights: false,
        changeTeamMemberRole: false,
        removeTeamMember: false,
    },
    email: '',
    about: '',
    avatar: '',
    member: undefined,
};

@localized()
@customElement('profile-layout')
export default class ProfileView extends ViewLayout {
    @property() me: Member = structuredClone(fallbackUser);
    @property() user: Member = structuredClone(fallbackUser);
    @property({ type: Object, reflect: true }) team: Team = {
        _id: '',
        maxMembers: 0,
        name: 'loading…',
        members: [structuredClone(fallbackUser)],
    };

    constructor() {
        super();
    }

    // Bootstraping any other lang than english
    updated(): void {
        const lang: string | null = localStorage.getItem('lang');

        if (lang && lang !== 'en') {
            setLocale(lang);
        }
    }

    createRenderRoot() {
        return this; // prevents creating a shadow root
    }

    async #getUserData() {
        const request = await fetch('/me', {
            method: 'GET',
            ...header,
        });
        const me = await request.json();

        this.me = me;

        return me;
    }

    async #hasUserDataChanged(newData: any) {
        const user = await this.#getUserData();
        const sameUsername = newData.username === user.username.toLowerCase();
        const sameEmail = newData.email === user.email;
        const sameAbout = newData.about === (user.about || '');

        if (sameUsername && sameEmail && sameAbout) {
            return false;
        }

        return true;
    }

    async #saveAccountChanges() {
        const usernameElem = this.querySelector('#username') as SlInput;
        const emailElem = this.querySelector('#mail') as SlInput;
        const aboutElem = this.querySelector('#about') as SlInput;
        const newData = {
            username: usernameElem.value.trim().toLowerCase(),
            email: emailElem.value,
            about: aboutElem.value.trim(),
        };
        const hasDataChanged = await this.#hasUserDataChanged(newData);

        if (!hasDataChanged) {
            return toast('neutral', msg('User Update'), msg('Change user details to trigger an update'));
        }

        const request = await fetch('/user', {
            method: 'POST',
            ...header,
            body: JSON.stringify({
                client,
                data: newData,
            }),
        });
        const json = await request.json();

        if (json.acknowledged) {
            toast('success', msg('User Update'), msg('Changes saved'));
        }
        if (json.refresh) {
            console.log('refreshing…');
            setTimeout(() => {
                location.reload();
            }, 2500);
        }
    }

    async #logout() {
        await fetch('/logout', {
            method: 'GET',
            ...header,
        });
        return location.reload();
    }

    #changeLangEvent({ target: { value } }: { target: { value: string } }) {
        setLocale(value);
        localStorage.setItem('lang', value);
        document.querySelector('html')?.setAttribute('lang', value);
    }

    #renderLanguageSelect() {
        const lang: string = localStorage.getItem('lang') || languages[0].code;

        return html` <sl-select
            size="small"
            @click="${this.#changeLangEvent}"
            label="${capitalize(msg('language'))}"
            value="${lang}"
            class="md:w-1/4"
        >
            ${repeat(languages, function ({ name, code }) {
                return html` <sl-option size="small" value="${code}">${name}</sl-option>`;
            })}
        </sl-select>`;
    }

    async #sendCheckPassword(oldPassword: string): Promise<boolean> {
        const request = await fetch('/checkPassword', {
            method: 'POST',
            ...header,
            body: JSON.stringify({
                data: {
                    password: oldPassword,
                },
                client,
            }),
        });
        const { auth } = await request.json();

        return auth;
    }

    async #sendChangePassword(newPassword: string) {
        const request = await fetch('/changePassword', {
            method: 'POST',
            ...header,
            body: JSON.stringify({
                data: {
                    password: newPassword,
                },
                client,
            }),
        });
        const json = await request.json();

        return json.status.acknowledged;
    }

    async #changePassword() {
        const oldPasswordElem = this.querySelector('#oldpassword') as SlInput;
        const newPasswordElem = this.querySelector('#newpassword') as SlInput;
        const newPasswordconfirmElem = this.querySelector('#newpasswordconfirm') as SlInput;
        const oldPassword = oldPasswordElem.value;
        const newPassword = newPasswordElem.value;
        const newPasswordConfirm = newPasswordconfirmElem.value;
        const samePassword = newPassword === newPasswordConfirm;
        const user = await this.#getUserData();

        if (oldPassword === '' || newPassword === '' || newPasswordConfirm === '') {
            return toast('warning', msg('New Password'), msg('Please fill out all fields'));
        }
        if (!samePassword) {
            return toast('warning', msg('New Password'), msg("New password doesn't match"));
        }
        if (oldPassword === newPassword) {
            return toast('warning', msg('New Password'), msg('Old password and new password are the same'));
        }
        if (!(await this.#sendCheckPassword(oldPassword))) {
            return toast('warning', msg('New Password'), msg('Old password is wrong'));
        }
        if (newPassword.length < passwordMinLength) {
            return toast('warning', msg('New Password'), msg('New password is too short, min 8 characterss'));
        }
        if (newPassword.length > passwordMaxLength) {
            return toast('warning', msg('New Password'), msg('New password is too long, max 35 characters'));
        }
        if (newPassword.includes(' ')) {
            return toast('warning', msg('New Password'), msg('New password cannot contain spaces'));
        }
        if (user.username === newPassword) {
            return toast('warning', msg('New Password'), msg('New password cannot be the same as your username'));
        }
        if (!/\d/.test(newPassword)) {
            return toast('warning', msg('New Password'), msg('New password must contain at least one number'));
        }
        if (!/[a-z]/.test(newPassword)) {
            return toast(
                'warning',
                msg('New Password'),
                msg('New password must contain at least one lowercase letter'),
            );
        }
        if (!/[A-Z]/.test(newPassword)) {
            return toast(
                'warning',
                msg('New Password'),
                msg('New password must contain at least one uppercase letter'),
            );
        }
        if (await this.#sendChangePassword(newPassword)) {
            setTimeout(() => location.reload(), 4000);
            return toast('success', msg('New Password'), msg('Password changed successfully, refresh in 5 seconds'));
        }

        return toast('danger', msg('New Password'), msg('Something went wrong'));
    }

    async #sendAvatar(file: File, imgTag: HTMLImageElement, e: ProgressEvent<FileReader>) {
        const request = await fetch('/changeAvatar', {
            method: 'POST',
            ...header,
            body: JSON.stringify({
                data: {
                    type: file.type,
                    name: file.name,
                    size: file.size,
                    lastModified: file.lastModified,
                    width: imgTag.width,
                    height: imgTag.height,
                    file: e.target?.result,
                },
                client,
            }),
        });
        const json = await request.json();

        return toast('success', msg('avatar'), msg('Avatar changed successfully, refresh to see changes'));
    }

    async #changeAvatarEvent(e: { target: { files: any[]; result: any } }) {
        const reader = new FileReader();
        const file = e.target.files[0];
        const imgTag = document.createElement('img');
        const url = URL.createObjectURL(file);

        reader.onload = (event: ProgressEvent<FileReader>) => {
            imgTag.src = url;

            imgTag.onload = () => {
                if (imgTag.width < avatarSize.large || imgTag.height < avatarSize.large) {
                    return toast('warning', msg('avatar'), msg('Image is too small, min 224x224'));
                }

                this.#sendAvatar(file, imgTag, event);
                URL.revokeObjectURL(url);
            };
        };

        reader.readAsDataURL(file);
    }

    #clickUploadAvatar() {
        const input = this.querySelector('input[type="file"]') as HTMLInputElement;
        input.click();
    }

    #renderAccountSection(content: Promise<any>) {
        return html` <div class="account-section">
                <div>
                    <div class="grid grid-rows-1 md:grid-cols-2 md:gap-4">
                        <sl-input
                            id="username"
                            minlength="3"
                            maxlength="20"
                            label="${capitalize(msg('username'))}"
                            size="small"
                            value="${until(
                                content.then(function (data) {
                                    return data.username;
                                }),
                                'Loading...',
                            )}"
                        ></sl-input>
                        <sl-input
                            id="mail"
                            label="${capitalize(msg('Email address'))}"
                            type="email"
                            size="small"
                            value="${until(
                                content.then(function (data) {
                                    return data.email;
                                }),
                                'Loading...',
                            )}"
                        >
                            <sl-icon name="envelope-at" slot="prefix"></sl-icon>
                        </sl-input>
                    </div>

                    <sl-textarea
                        id="about"
                        maxlength="${maxLengthAbout}"
                        resize="none"
                        size="small"
                        rows="7"
                        help-text="${msg('write something about you')}"
                        label="${capitalize(msg('about'))}"
                        value="${until(
                            content.then(function (data) {
                                return data.about;
                            }),
                            '',
                        )}"
                    ></sl-textarea>
                </div>
                <div>
                    <p>${capitalize(msg('photo'))}</p>
                    <sl-tooltip content="${msg('click to upload new avatar')}" placement="top">
                        <sl-avatar
                            @click="${this.#clickUploadAvatar}"
                            style="--size: 14rem;"
                            image="${until(
                                content.then(function (data) {
                                    if (data.avatar) {
                                        return `${data.avatar}avatar_large.webp`;
                                    }

                                    return imgs.avatar;
                                }),
                                imgs.avatar,
                            )}"
                        ></sl-avatar>
                        <input
                            @change="${this.#changeAvatarEvent}"
                            type="file"
                            class="hidden"
                            accept="image/jpeg,image/jpg,image/webp,image/png"
                        />
                    </sl-tooltip>
                </div>
            </div>
            <sl-divider style="--width: 2px;"></sl-divider>
            ${this.#renderLanguageSelect()}
            <sl-divider style="--width: 2px;"></sl-divider>
            <div>
                <sl-button size="small" variant="danger" @click="${this.#logout}">logout</sl-button>
                <sl-button size="small" variant="primary" class="float-right" @click="${this.#saveAccountChanges}"
                    >${msg('save')}</sl-button
                >
            </div>`;
    }

    #renderPasswordSection() {
        return html`<div class="password-section">
            <sl-input
                id="oldpassword"
                size="small"
                label="${capitalize(msg('Old Password'))}:"
                type="password"
                password-toggle
            >
            </sl-input>
            <sl-input
                id="newpassword"
                size="small"
                minlength="${passwordMinLength}"
                maxlength="${passwordMaxLength}"
                label="${capitalize(msg('New Password'))}:"
                type="password"
                password-toggle
            ></sl-input>
            <sl-input
                id="newpasswordconfirm"
                size="small"
                minlength="${passwordMinLength}"
                maxlength="${passwordMaxLength}"
                label="${capitalize(msg('Confirm New Password'))}:"
                type="password"
                password-toggle
            ></sl-input>
            <sl-button @click="${this.#changePassword}" class="mt-4" size="small" variant="danger"
                >${msg('update password')}</sl-button
            >
        </div>`;
    }

    #bootstrapFirstClickOnTeamTab() {
        const hasActive = this.querySelector(`.team-member.${activeMemberClass}`);

        if (!hasActive) {
            const memberElem = this?.querySelector('.team-member') as HTMLElement;
            const _id = memberElem?.getAttribute('data-id') as string;
            const member = this.team.members.find((member: Member) => member._id === _id);

            if (member) {
                return this.#clickOnteamMember(member);
            }
        }
    }

    async #tabSwitchEvent({ detail: { name } }: { detail: { name: string } }) {
        if (name === 'team') {
            const teamRequest = await fetch('/team', {
                method: 'GET',
                ...header,
            });
            const team = await teamRequest.json();
            const membersRequest = await fetch('/getUsers', {
                method: 'POST',
                ...header,
                body: JSON.stringify({
                    data: {
                        ids: team.members.map((member: Member) => member.member),
                    },
                    client,
                }),
            });
            const members = await membersRequest.json();

            this.team = team as Team;
            this.team.members = this.team.members.map((member: Member, i: number) => {
                return {
                    ...member,
                    ...members[i],
                };
            });
            this.requestUpdate();
            requestAnimationFrame(() => {
                this.#bootstrapFirstClickOnTeamTab();
            });
        }
    }

    async #changedTeamMemberRightsEvent(member: Member, key: keyof Rights, value: boolean) {
        const request = await fetch('/team/changeTeamMemberRights', {
            method: 'POST',
            ...header,
            body: JSON.stringify({
                data: {
                    member,
                    rights: {
                        ...member.rights,
                        [key]: value,
                    },
                },
                client,
            }),
        });
        await request.json();

        Object.defineProperty(member.rights, key, { value: value });
        this.team.members.forEach((tMember: Member) => {
            if (member._id === tMember.member) {
                Object.defineProperty(tMember.rights, key, { value: value });
            }
        });
    }

    #clickOnteamMember(member: Member) {
        const hasActive = this.querySelector(`.team-member.${activeMemberClass}`) as HTMLElement;
        const active_id = hasActive?.getAttribute('data-id');

        this.user = member;

        if (active_id !== member._id) {
            const newActive = this?.querySelector(`.team-member[data-id="${member._id}"]`) as HTMLElement;

            hasActive?.classList.remove(activeMemberClass);
            newActive.classList.add(activeMemberClass);

            return this.requestUpdate();
        }
    }

    #renderTeamSection() {
        const { _id, ...rights } = this.user.rights;
        const myRights = this.team.members.find((member: Member) => member.member === this.me._id)?.rights;
        const activeButton = html`<sl-button variant="danger" size="small" class="float-right">
            <sl-icon slot="prefix" name="x-lg"></sl-icon>Remove</sl-button
        >`;
        const disabledButton = html`<sl-button variant="danger" size="small" class="float-right" disabled>
            <sl-icon slot="prefix" name="x-lg"></sl-icon>Remove</sl-button
        >`;

        return html`<div class="team-section">
            <div>
                <div>
                    <sl-input size="small" label="${capitalize(msg('search'))}">
                        <sl-icon name="search" type="text" slot="prefix"></sl-icon>
                    </sl-input>
                    <div class="mt-4">
                        ${repeat(
                            this.team.members,
                            member => member._id,
                            member => {
                                return html`<div
                                    class="team-member"
                                    @click="${() => this.#clickOnteamMember(member)}"
                                    data-id="${member._id}"
                                    tabindex="0"
                                >
                                    <sl-avatar
                                        image="${member.avatar ? `${member.avatar}avatar_small.webp` : imgs.avatar}"
                                    ></sl-avatar>
                                    <div>
                                        <p>${member.username}</p>
                                        <p>${msg('role')}: ${member.role}</p>
                                    </div>
                                </div>`;
                            },
                        )}
                    </div>
                </div>
            </div>
            <div class="selected-team-section">
                <sl-avatar
                    style="--size: 8rem;"
                    image="${this.user.avatar ? `${this.user.avatar}avatar_medium.webp` : imgs.avatar}"
                ></sl-avatar>

                <h2 class="text-2xl font-bold">
                    ${msg('{{1}} member of {{2}}')
                        .replace('{{1}}', this.user.username)
                        .replace('{{2}}', this.team.name)}
                    ${this.me._id === this.user._id || !myRights?.removeTeamMember ? disabledButton : activeButton}
                </h2>
                <sl-divider style="--width: 2px;"></sl-divider>
                <div>
                    <p class="text-xl mb-4">${capitalize(msg('rights'))}</p>
                    <div class="selected-team-section-rights">
                        ${repeat(
                            Object.entries(rights),
                            kvPair => kvPair[0],
                            ([key, value]) => {
                                const itsMe = this.me._id === this.user._id;
                                const slSwitch = value
                                    ? html`<sl-switch
                                          @sl-change="${() =>
                                              this.#changedTeamMemberRightsEvent(
                                                  this.user,
                                                  key as keyof Rights,
                                                  !value,
                                              )}"
                                          ?disabled="${itsMe || !myRights?.changeTeamMemberRights}"
                                          checked
                                      ></sl-switch>`
                                    : html`<sl-switch
                                          @sl-change="${() =>
                                              this.#changedTeamMemberRightsEvent(
                                                  this.user,
                                                  key as keyof Rights,
                                                  !value,
                                              )}"
                                          ?disabled="${itsMe || !myRights?.changeTeamMemberRights}"
                                      ></sl-switch>`;

                                return html`<div class="selected-team-section-right">
                                    <span>${transRights(key)}</span> ${slSwitch}
                                    <p class="text-xs text-gray-600">${transRightsInfo(key)}</p>
                                    <i></i>
                                </div>`;
                            },
                        )}
                    </div>
                </div>
                <sl-divider style="--width: 2px;"></sl-divider>
                <div class="selected-team-section-stats">
                    <div>
                        <p class="text-gray-600">${msg('name')}</p>
                        <p>${this.user.username}</p>
                    </div>
                    <div>
                        <p class="text-gray-600">${msg('Email address')}</p>
                        <a href="mailto:${this.user.email}">${this.user.email}</a>
                    </div>
                    <div>
                        <p class="text-gray-600">${capitalize(msg('role'))}</p>
                        <p>${this.user.role}</p>
                    </div>
                </div>

                <div>
                    <p class="text-gray-600">${capitalize(msg('about'))}</p>
                    <p>${this.user.about}</p>
                </div>
                <br />
            </div>
        </div>`;
    }

    #renderRows() {
        const content = fetch('/me', {
            method: 'GET',
        }).then(r => r.json());

        const row1 = html`<sl-tab-group @sl-tab-show="${this.#tabSwitchEvent}">
            <sl-tab slot="nav" panel="account">${capitalize(msg('account'))}</sl-tab>
            <sl-tab slot="nav" panel="password">${capitalize(msg('password'))}</sl-tab>
            <sl-tab slot="nav" panel="team">${capitalize(msg('team'))}</sl-tab>

            <sl-tab-panel class="mt-8" name="account">${this.#renderAccountSection(content)}</sl-tab-panel>
            <sl-tab-panel class="mt-8" name="password">${this.#renderPasswordSection()}</sl-tab-panel>
            <sl-tab-panel class="mt-8" name="team">${this.#renderTeamSection()}</sl-tab-panel>
        </sl-tab-group> `;
        return [row1];
    }

    connectedCallback(): void {
        super.connectedCallback();
        this.#getUserData();
    }

    render() {
        const rows = this.#renderRows();
        return super.render(rows);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'profile-layout': ProfileView;
    }
}
