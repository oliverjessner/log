var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html } from 'lit';
import { msg, localized } from '@lit/localize';
import { customElement, property } from 'lit/decorators.js';
import ViewLayout from '../view';
import header from '../../data/header';
import { setLocale } from '../../utilities/language/language';
import { capitalize } from '../../utilities/text/text';
import { languages } from '../../data/langs';
import { client } from '../../data/misc';
import toast from '../../utilities/toast/toast';
import { repeat } from 'lit/directives/repeat.js';
import { imgs } from '../../data/fallbacks';
import avatarSize from '../../data/shared/avatarSizes';
import { transRights, transRightsInfo } from '../../utilities/trans/trans';
const passwordMinLength = 8;
const passwordMaxLength = 35;
const maxLengthAbout = 560;
const activeMemberClass = 'team-member-active';
const fallbackUser = {
    _id: '',
    username: '',
    role: '',
    roleName: '',
    email: '',
    about: '',
    avatar: '',
    member: undefined,
    isSuperAdmin: false,
};
let ProfileView = class ProfileView extends ViewLayout {
    rights = {
        _id: '',
        name: '',
        addTeamMember: false,
        removeTeamMember: false,
        changeTeamMemberRole: false,
        changeTeamMemberRights: false,
        createRole: false,
    };
    me = structuredClone(fallbackUser);
    user = structuredClone(fallbackUser);
    team = {
        _id: '',
        maxMembers: 0,
        name: 'loading…',
        members: [structuredClone(fallbackUser)],
    };
    roles = [
        {
            _id: '',
            name: 'member',
            teamId: '',
            __v: 0,
        },
    ];
    activeSearchResults = '0';
    constructor() {
        super();
    }
    // Bootstraping any other lang than english
    updated() {
        const lang = localStorage.getItem('lang');
        if (lang && lang !== 'en') {
            setLocale(lang);
        }
    }
    async connectedCallback() {
        const request = await fetch('/me');
        const json = await request.json();
        super.connectedCallback();
        this.#getUserData();
        await this.#getRole();
        this.me = json;
    }
    createRenderRoot() {
        return this; // prevents creating a shadow root
    }
    async #getRole() {
        const request = await fetch('/role/getRole', {
            method: 'GET',
            ...header,
        });
        const role = await request.json();
        this.rights = role;
        return role;
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
    async #hasUserDataChanged(newData) {
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
        const usernameElem = this.querySelector('#username');
        const emailElem = this.querySelector('#mail');
        const aboutElem = this.querySelector('#about');
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
    #changeLangEvent({ target: { value } }) {
        setLocale(value);
        localStorage.setItem('lang', value);
        document.querySelector('html')?.setAttribute('lang', value);
    }
    #renderLanguageSelect() {
        const lang = localStorage.getItem('lang') || languages[0].code;
        return html `<sl-select
            size="small"
            @click="${this.#changeLangEvent}"
            label="${capitalize(msg('language'))}"
            value="${lang}"
            class="md:w-1/4"
        >
            ${repeat(languages, function ({ name, code }) {
            return html `<sl-option size="small" value="${code}">${name}</sl-option>`;
        })}
        </sl-select>`;
    }
    async #sendCheckPassword(oldPassword) {
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
    async #sendChangePassword(newPassword) {
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
        const oldPasswordElem = this.querySelector('#oldpassword');
        const newPasswordElem = this.querySelector('#newpassword');
        const newPasswordconfirmElem = this.querySelector('#newpasswordconfirm');
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
            return toast('warning', msg('New Password'), msg('New password must contain at least one lowercase letter'));
        }
        if (!/[A-Z]/.test(newPassword)) {
            return toast('warning', msg('New Password'), msg('New password must contain at least one uppercase letter'));
        }
        if (await this.#sendChangePassword(newPassword)) {
            setTimeout(() => location.reload(), 4000);
            return toast('success', msg('New Password'), msg('Password changed successfully, refresh in 5 seconds'));
        }
        return toast('danger', msg('New Password'), msg('Something went wrong'));
    }
    async #sendAvatar(file, imgTag, e) {
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
        await request.json();
        return toast('success', msg('avatar'), msg('Avatar changed successfully, refresh to see changes'));
    }
    async #changeAvatarEvent(e) {
        const reader = new FileReader();
        const file = e.target.files[0];
        const imgTag = document.createElement('img');
        const url = URL.createObjectURL(file);
        reader.onload = (event) => {
            imgTag.src = url;
            imgTag.onload = () => {
                if (file.size > avatarSize.file.maxSize) {
                    return toast('warning', msg('avatar'), msg('Image is too big, max 4mb'));
                }
                if (imgTag.width < avatarSize.resolution.large || imgTag.height < avatarSize.resolution.large) {
                    return toast('warning', msg('avatar'), msg('Image is too small, min 224x224'));
                }
                this.#sendAvatar(file, imgTag, event);
                URL.revokeObjectURL(url);
            };
        };
        reader.readAsDataURL(file);
    }
    #clickUploadAvatar() {
        const input = this.querySelector('input[type="file"]');
        input.click();
    }
    #renderAccountSection() {
        return html `<div class="account-section">
                <div>
                    <div class="grid grid-rows-1 md:grid-cols-2 md:gap-4">
                        <sl-input
                            id="username"
                            minlength="3"
                            maxlength="20"
                            label="${capitalize(msg('username'))}"
                            size="small"
                            value="${this.me.username}"
                        ></sl-input>
                        <sl-input
                            id="mail"
                            label="${capitalize(msg('Email address'))}"
                            type="email"
                            size="small"
                            value="${this.me.email}"
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
                        value="${this.me.about}"
                    ></sl-textarea>
                </div>
                <div>
                    <p>${capitalize(msg('photo'))}</p>
                    <sl-tooltip content="${msg('click to upload new avatar')}" placement="top">
                        <sl-avatar
                            @click="${this.#clickUploadAvatar}"
                            style="--size: 14rem;"
                            image="${this.me.avatar ? `${this.me.avatar}avatar_large.webp` : imgs.avatar}"
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
        return html `<div class="password-section">
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
            const memberElem = this?.querySelector('.team-member');
            const _id = memberElem?.getAttribute('data-id');
            const member = this.team.members.find((member) => member._id === _id);
            if (member) {
                return this.#clickOnteamMember(member);
            }
        }
    }
    async #getRoles() {
        const rolesRequest = await fetch('/role/getRoles', {
            method: 'GET',
            ...header,
        });
        return await rolesRequest.json();
    }
    async #switchToTeamTab() {
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
                    ids: team.members,
                },
                client,
            }),
        });
        const unsortMembers = await membersRequest.json();
        const members = unsortMembers.sort((a, b) => a.username.localeCompare(b.username));
        const roles = await this.#getRoles();
        this.roles = roles;
        this.team = team;
        this.team.members = this.team.members.map((member, i) => {
            return {
                member,
                ...members[i],
            };
        });
        if (this.activeSearchResults === '0') {
            this.activeSearchResults = this.team.members.length + '';
        }
        this.requestUpdate();
        requestAnimationFrame(() => {
            this.#bootstrapFirstClickOnTeamTab();
        });
    }
    async #switchToRoleTab() {
        const roles = await this.#getRoles();
        this.roles = roles;
        this.requestUpdate();
    }
    async #tabSwitchEvent({ detail: { name } }) {
        if (name === 'team') {
            return await this.#switchToTeamTab();
        }
        if (name === 'role') {
            return await this.#switchToRoleTab();
        }
    }
    #clickOnteamMember(member) {
        const hasActive = this.querySelector(`.team-member.${activeMemberClass}`);
        const active_id = hasActive?.getAttribute('data-id');
        this.user = member;
        if (active_id !== member._id) {
            const newActive = this?.querySelector(`.team-member[data-id="${member._id}"]`);
            hasActive?.classList.remove(activeMemberClass);
            newActive.classList.add(activeMemberClass);
            return this.requestUpdate();
        }
    }
    #closeRemoveTeamMemberDialog() {
        const dialog = this.querySelector('#remove-team-member-dialog');
        dialog?.hide();
    }
    #closeAddMemberDialog() {
        const dialog = this.querySelector('#add-member-dialog');
        dialog?.hide();
    }
    #openRemoveTeamMemberDialog() {
        const dialog = this.querySelector('#remove-team-member-dialog');
        dialog?.show();
    }
    async #removeTeamMember() {
        const request = await fetch('/team/removeMember', {
            method: 'POST',
            ...header,
            body: JSON.stringify({
                data: {
                    member: this.user,
                },
                client,
            }),
        });
        await request.json();
        await this.#tabSwitchEvent({ detail: { name: 'team' } });
        this.#closeRemoveTeamMemberDialog();
        return toast('success', msg('team'), msg('member removed successfully'));
    }
    async #changeRoleEvent({ target }) {
        const role = target.value;
        const member = this.team.members.find((member) => member._id === this.user._id);
        if (!role || !member || role === this.user.roleName) {
            return;
        }
        const request = await fetch('/team/changeRole', {
            method: 'POST',
            ...header,
            body: JSON.stringify({
                data: {
                    member: this.user,
                    role,
                },
                client,
            }),
        });
        await request.json();
        member.roleName = role;
        this.user.roleName = role;
        this.requestUpdate();
        return toast('success', msg('role'), msg('role changed successfully'));
    }
    async #addNewTeamMember() {
        const emailInput = this.querySelector('#add-member-email');
        const dialog = this.querySelector('#add-member-dialog');
        const roleInput = this.querySelector('#add-member-role');
        if (!emailInput.checkValidity()) {
            return;
        }
        const request = await fetch('/team/addMember', {
            method: 'POST',
            ...header,
            body: JSON.stringify({
                data: {
                    member: this.user,
                    email: emailInput.value,
                    roleName: roleInput.value,
                },
                client,
            }),
        });
        const json = await request.json();
        if (json.error) {
            return toast('warning', msg('team'), json.error);
        }
        dialog?.hide();
        this.#switchToTeamTab();
        return toast('success', msg('team'), msg('member added successfully'));
    }
    #openAddNewTeamMember() {
        const dialog = this.querySelector('#add-member-dialog');
        const emailInput = this.querySelector('#add-member-email');
        dialog?.show();
        return setTimeout(() => emailInput.focus(), 400);
    }
    #renderRemoveMemberDialog() {
        const dialogText = msg('Are you sure you want to remove {{1}} from {{2}}?')
            .replace('{{1}}', this.user.username)
            .replace('{{2}}', this.team.name);
        return html `<sl-dialog
            label="${capitalize(msg('attention'))}"
            class="dialog-overview"
            id="remove-team-member-dialog"
        >
            ${dialogText}
            <sl-button @click="${this.#removeTeamMember}" class="float-left" slot="footer" variant="danger"
                >${msg('yes')}</sl-button
            >
            <sl-button @click="${this.#closeRemoveTeamMemberDialog}" slot="footer" variant="neutral"
                >${msg('no')}</sl-button
            >
        </sl-dialog>`;
    }
    #renderAddMemberDialog(roleOptions) {
        return html `<sl-dialog
            label="${msg('Add a new member to the team')}"
            class="dialog-overview"
            id="add-member-dialog"
        >
            <p class="text-gray-600 select-none">${msg('New member role')}</p>
            <sl-select class="w-1/2" size="small" value="${this.roles[0].name}" id="add-member-role" hoist
                >${roleOptions}</sl-select
            >
            <sl-input
                class="w-full"
                size="small"
                type="email"
                label="${capitalize(msg('E-Mail'))}"
                id="add-member-email"
            >
                <sl-icon name="envelope-at" type="text" slot="prefix"></sl-icon>
            </sl-input>
            <sl-button @click="${this.#addNewTeamMember}" class="float-left" slot="footer" variant="danger"
                >${msg('yes')}</sl-button
            >
            <sl-button @click="${this.#closeAddMemberDialog}" slot="footer" variant="neutral">${msg('no')}</sl-button>
        </sl-dialog>`;
    }
    #searchForUser({ target }) {
        const search = target.value.toLowerCase();
        const users = this.team.members.filter((user) => user.username.toLowerCase().includes(search));
        const ids = users.map((user) => user._id);
        const usersList = [...this.querySelectorAll('.team-member')];
        if (search === '') {
            this.activeSearchResults = this.team.members.length + '';
            usersList.forEach((user) => user.classList.remove('!hidden'));
            return this.requestUpdate();
        }
        usersList.forEach((user) => {
            if (ids.includes(user.getAttribute('data-id'))) {
                return user.classList.remove('!hidden');
            }
            return user.classList.add('!hidden');
        });
        this.activeSearchResults = ids.length + '';
        return this.requestUpdate();
    }
    #renderTeamSection() {
        const activeButton = html `<sl-button
            variant="danger"
            size="small"
            class="float-right"
            @click="${this.#openRemoveTeamMemberDialog}"
        >
            <sl-icon slot="prefix" name="x-lg"></sl-icon>Remove</sl-button
        >`;
        const disabledButton = html `<sl-button variant="danger" size="small" class="float-right" disabled>
            <sl-icon slot="prefix" name="x-lg"></sl-icon>Remove</sl-button
        >`;
        const isSuperAdmin = html `<div>
            <p class="text-gray-600 select-none">${capitalize(msg('Super Admin'))}</p>
            <sl-icon name="check2-all"></sl-icon>
        </div>`;
        const roleOptions = repeat(this.roles, role => role._id, role => {
            return html `<sl-option value="${role.name}">${role.name}</sl-option>`;
        });
        return html `<div class="team-section">
                <div class="overflow-hidden md:h-[calc(100vh - 175px)]">
                    <div class="flex items-end gap-2">
                        <sl-input
                            @keyup="${this.#searchForUser}"
                            class="w-full"
                            size="small"
                            label="${capitalize(msg('search'))} ${msg('team members')}  ${this
            .activeSearchResults} / ${this.team.members.length}"
                        >
                            <sl-icon name="search" type="text" slot="prefix"></sl-icon>
                        </sl-input>
                        ${this.rights.addTeamMember
            ? html `<sl-button variant="success" size="small" @click="${this.#openAddNewTeamMember}">
                                  <sl-icon slot="prefix" name="plus-lg"></sl-icon>
                              </sl-button>`
            : html `<sl-button variant="success" size="small" disabled>
                                  <sl-icon slot="prefix" name="plus-lg"></sl-icon>
                              </sl-button>`}
                    </div>
                    <div class="team-section-members">
                        ${repeat(this.team.members, member => member._id, member => {
            return html `<div
                                    class="team-member"
                                    @click="${() => this.#clickOnteamMember(member)}"
                                    @keyup="${() => this.#clickOnteamMember(member)}"
                                    data-id="${member._id}"
                                    tabindex="0"
                                >
                                    <sl-avatar
                                        image="${member.avatar ? `${member.avatar}avatar_small.webp` : imgs.avatar}"
                                    ></sl-avatar>
                                    <div>
                                        <p>${member.username}</p>
                                        <p>${msg('role')}: ${member.roleName}</p>
                                    </div>
                                </div>`;
        })}
                    </div>
                </div>
                <div class="selected-team-section">
                    <div>
                        <sl-avatar
                            style="--size: 8rem;"
                            image="${this.user.avatar ? `${this.user.avatar}avatar_medium.webp` : imgs.avatar}"
                        ></sl-avatar>
                        ${this.me._id === this.user._id || !this.rights.removeTeamMember
            ? disabledButton
            : activeButton}
                    </div>
                    <sl-divider style="--width: 2px;"></sl-divider>
                    <div class="selected-team-section-stats">
                        <div>
                            <p class="text-gray-600 select-none">${capitalize(msg('role'))}</p>

                            ${this.rights.changeTeamMemberRole && this.me._id !== this.user._id
            ? html `<sl-select
                                      class="w-1/2"
                                      size="small"
                                      value="${this.user.roleName}"
                                      @click="${this.#changeRoleEvent}"
                                  >
                                      ${roleOptions}
                                  </sl-select>`
            : html `<sl-select class="w-1/2" size="small" value="${this.user.roleName}" disabled>
                                      ${roleOptions}
                                  </sl-select>`}
                        </div>
                        <div>
                            <p class="text-gray-600 select-none">${capitalize(msg('name'))}</p>
                            <p>${this.user.username}</p>
                        </div>
                        <div>
                            <p class="text-gray-600 select-none">${msg('Email address')}</p>
                            <a href="mailto:${this.user.email}">${this.user.email}</a>
                        </div>
                        <div>
                            <p class="text-gray-600 select-none">${capitalize(msg('team'))}</p>
                            <p>${this.team.name}</p>
                        </div>

                        ${this.user.isSuperAdmin ? isSuperAdmin : ''}
                    </div>

                    <div>
                        <p class="text-gray-600 select-none">${capitalize(msg('about'))}</p>
                        <p>${this.user.about}</p>
                    </div>
                    <br />
                </div>
            </div>
            ${this.#renderRemoveMemberDialog()} ${this.#renderAddMemberDialog(roleOptions)}`;
    }
    async #removeRole() {
        const selectedRoleElem = this.querySelector('#remove-role-select');
        const selectedRole = selectedRoleElem.value;
        if (selectedRole !== 'member' && selectedRole !== 'admin') {
            const request = await fetch('/role/removeRole', {
                method: 'POST',
                ...header,
                body: JSON.stringify({ roleName: selectedRole }),
            });
            await request.json();
            return toast('neutral', msg('role'), msg('You have successfully removed the role {{1}}').replace('{{1}}', selectedRole));
        }
        else {
            return toast('warning', msg('role'), msg('You cannot remove member or admin role'));
        }
    }
    #removeRoleEvent() {
        const removeRoleDialog = this.querySelector('#remove-role-dialog');
        removeRoleDialog.show();
    }
    #addRoleEvent() {
        const addRoleDialog = this.querySelector('#add-new-role-dialog');
        addRoleDialog.show();
    }
    #renderRoleSection() {
        const defaultRole = this.roles.find(role => role.name === 'member') || this.roles[0];
        const { __v, _id, name, teamId, ...rights } = defaultRole;
        const rightsArray = Object.entries(rights);
        return html `<div class="roles-settings">
                <div class="flex flex-col gap-2">
                    <sl-select label="${capitalize(msg('role'))}" size="small" value="${defaultRole?.name}" hoist>
                        ${repeat(this.roles, role => role._id, function (role) {
            return html `<sl-option value="${role.name}">${role.name}</sl-option>`;
        })}</sl-select
                    >

                    <sl-button @click="${this.#addRoleEvent}" variant="success" size="small">
                        <sl-icon slot="prefix" name="plus-lg"></sl-icon>
                        ${capitalize(msg('add role'))}</sl-button
                    >
                    <sl-button @click="${this.#removeRoleEvent}" variant="danger" size="small"
                        ><sl-icon slot="prefix" name="trash"></sl-icon>${capitalize(msg('remove role'))}</sl-button
                    >
                </div>
                <div class="rights-settings">
                    ${repeat(rightsArray, role => role[0], ([key, value]) => {
            const switchSL = value
                ? html `<sl-switch label="${key}" checked></sl-switch>`
                : html `<sl-switch label="${key}"></sl-switch>`;
            return html ` <p>${transRights(key)}</p>
                                ${switchSL}
                                <p class="text-gray-600 select-none mb-4">${transRightsInfo(key)}</p>
                                <i></i>`;
        })}
                </div>
            </div>
            <sl-dialog id="add-new-role-dialog" label="${capitalize(msg('role'))}">
                >
                <sl-input label="${msg('New role name')}" size="small"></sl-input>
                <sl-button class="float-left" slot="footer" variant="success">${msg('accept')}</sl-button>
                <sl-button slot="footer" variant="neutral">${msg('cancel')}</sl-button>
            </sl-dialog>
            <sl-dialog id="remove-role-dialog" label="${capitalize(msg('role'))}">
                <p>${msg('Are you sure you want to remove this role?')}</p>
                <sl-button class="float-left" slot="footer" variant="danger">${msg('yes')}</sl-button>
                <sl-button slot="footer" variant="neutral">${msg('no')}</sl-button>
            </sl-dialog>`;
    }
    #renderRows() {
        const row1 = html `<sl-tab-group @sl-tab-show="${this.#tabSwitchEvent}">
            <sl-tab slot="nav" panel="account">${capitalize(msg('account'))}</sl-tab>
            <sl-tab slot="nav" panel="password">${capitalize(msg('password'))}</sl-tab>
            <sl-tab slot="nav" panel="team">${capitalize(msg('team'))}</sl-tab>
            <sl-tab slot="nav" panel="role">${capitalize(msg('role'))}</sl-tab>

            <sl-tab-panel class="mt-8" name="account">${this.#renderAccountSection()}</sl-tab-panel>
            <sl-tab-panel class="mt-8" name="password">${this.#renderPasswordSection()}</sl-tab-panel>
            <sl-tab-panel class="mt-8" name="team">${this.#renderTeamSection()}</sl-tab-panel>
            <sl-tab-panel class="mt-8" name="role">${this.#renderRoleSection()}</sl-tab-panel>
        </sl-tab-group> `;
        return [row1];
    }
    render() {
        const rows = this.#renderRows();
        return super.render(rows);
    }
};
__decorate([
    property()
], ProfileView.prototype, "rights", void 0);
__decorate([
    property()
], ProfileView.prototype, "me", void 0);
__decorate([
    property()
], ProfileView.prototype, "user", void 0);
__decorate([
    property({ type: Object, reflect: true })
], ProfileView.prototype, "team", void 0);
__decorate([
    property()
], ProfileView.prototype, "roles", void 0);
__decorate([
    property()
], ProfileView.prototype, "activeSearchResults", void 0);
ProfileView = __decorate([
    localized(),
    customElement('profile-layout')
], ProfileView);
export default ProfileView;
