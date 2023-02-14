# NodeBB Poll plugin (PKU Anvil)

This is a fork of https://github.com/NodeBB/nodebb-plugin-poll for pkuanvil, although this should principally mergeable to official plugin.

The plugin is refactored this plugin to ES2017 await/async, migrated the Settings to `meta.settings` (because we don't want to work with the old Settings). There are also various user interaction improvements and bug fixes.

## Migration
This is not a seamless upgrade from nodebb-plugin-poll. (We publish under the name of @pkuanvil/nodebb-plugin-poll). We intentionally made a fork because want to add features that is likely only interesting for pkuanvil (like hiding voters by default).

We preserved the original markup syntax and database structure, but migrated the settings module (so the original settings need to be set in ACP again), and does semantics changes to various guest options so details and create privilege unconditionally throws error for guests.

## NodeBB Poll plugin

This NodeBB plugin will allow you to add polls to the first post of a topic with the following markup:

    [poll <settings>]
    - Poll option
    - Another option
    [/poll]

Currently supported settings:

    maxvotes="1" //Max number of votes per user. If larger than 1, a multiple choice poll will be created
    disallowVoteUpdate="0" //if set, users won't be able to update/remove their vote
    title="Poll title" //Poll title

There's also a helpful modal available that will allow you to easily create a poll:
![poll-creator](https://user-images.githubusercontent.com/119569118/218652192-220fca1f-2a48-4f0b-8655-bd072731ce53.png)

## Todo

- Add the ability to edit a poll
- Anonymous voting
- A lot more...

If you're willing to help, please make any improvements you want and submit a PR.
