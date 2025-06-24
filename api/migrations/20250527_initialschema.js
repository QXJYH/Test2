exports.up = function(knex) {
  return knex.schema
    .createTable('abuse_report', table => {
      table.string('id', 128).notNullable().unique();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('author_id');
      table.integer('report_reason').notNullable();
      table.integer('report_status').notNullable();
      table.string('report_message', 1024).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })

    .createTable('asset', table => {
      table.bigInteger('roblox_asset_id');
      table.bigInteger('id').notNullable().primary();
      table.string('name', 255).notNullable();
      table.string('description', 4096).defaultTo(null);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.smallint('asset_type').notNullable();
      table.smallint('asset_genre').notNullable();
      table.smallint('creator_type').notNullable();
      table.bigInteger('creator_id').notNullable();
      table.smallint('moderation_status').notNullable();
      table.boolean('is_for_sale').defaultTo(false).notNullable();
      table.bigInteger('price_robux');
      table.bigInteger('price_tix');
      table.boolean('is_limited').defaultTo(false).notNullable();
      table.boolean('is_limited_unique').defaultTo(false).notNullable();
      table.bigInteger('serial_count');
      table.bigInteger('sale_count').defaultTo(0).notNullable();
      table.timestamp('offsale_at');
      table.bigInteger('recent_average_price');
      table.boolean('comments_enabled').defaultTo(false).notNullable();
      table.boolean('is_18_plus').defaultTo(false).notNullable();
    })
    .createTable('asset_advertisement', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('target_id').notNullable();
      table.smallint('target_type').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.smallint('advertisement_type').notNullable();
      table.bigInteger('advertisement_asset_id').notNullable();
      table.string('name', 512).notNullable();
      table.bigInteger('impressions_all').defaultTo(0).notNullable();
      table.bigInteger('clicks_all').defaultTo(0).notNullable();
      table.bigInteger('bid_amount_tix_all').defaultTo(0).notNullable();
      table.bigInteger('bid_amount_robux_all').defaultTo(0).notNullable();
      table.bigInteger('impressions_last_run').defaultTo(0).notNullable();
      table.bigInteger('clicks_last_run').defaultTo(0).notNullable();
      table.bigInteger('bid_amount_robux_last_run').defaultTo(0).notNullable();
      table.bigInteger('bid_amount_tix_last_run').defaultTo(0).notNullable();
    })
    .createTable('asset_comment', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('asset_id').notNullable();
      table.bigInteger('user_id').notNullable();
      table.string('comment', 1024).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('asset_datastore', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('asset_id').notNullable();
      table.bigInteger('universe_id').notNullable();
      table.string('scope', 255).notNullable();
      table.string('key', 255).notNullable();
      table.string('name', 255).notNullable();
      table.string('value', 1048576).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('asset_favorite', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('asset_id').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('asset_icon', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('asset_id').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.string('content_url', 512).notNullable();
      table.smallint('moderation_status').notNullable();
    })
    .createTable('asset_media', table => {
      table.bigInteger('id').notNullable().primary();
      table.integer('asset_type').notNullable();
      table.bigInteger('asset_id').notNullable();
      table.bigInteger('media_asset_id');
      table.string('media_video_hash', 128).defaultTo(null);
      table.string('media_video_title', 128).defaultTo(null);
      table.boolean('is_approved').defaultTo(false).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('asset_package', table => {
      table.bigInteger('package_asset_id').notNullable();
      table.bigInteger('asset_id').notNullable();
      table.primary(['package_asset_id', 'asset_id']);
    })
    .createTable('asset_place', table => {
      table.bigInteger('asset_id').notNullable().primary();
      table.integer('max_player_count').defaultTo(10).notNullable();
      table.integer('server_fill_mode').defaultTo(1).notNullable();
      table.integer('server_slot_size');
      table.boolean('is_vip_enabled').defaultTo(false).notNullable();
      table.integer('vip_price');
      table.boolean('is_public_domain').defaultTo(false).notNullable();
      table.integer('access').defaultTo(1).notNullable();
      table.bigInteger('visit_count').defaultTo(0).notNullable();
    })
    .createTable('asset_play_history', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('asset_id').notNullable();
      table.bigInteger('user_id').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('ended_at');
    })
    .createTable('asset_server', table => {
      table.uuid('id').notNullable().primary();
      table.bigInteger('asset_id').notNullable();
      table.string('ip', 255).notNullable();
      table.integer('port').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.string('server_connection', 255).notNullable();
    })
    .createTable('asset_server_player', table => {
      table.uuid('server_id').notNullable();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('asset_id').notNullable();
      table.primary(['server_id', 'user_id', 'asset_id']);
    })
    .createTable('asset_thumbnail', table => {
      table.bigInteger('asset_id').notNullable();
      table.bigInteger('asset_version_id').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.string('content_url', 512).notNullable();
      table.smallint('moderation_status').notNullable();
    })
    .createTable('asset_version', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('asset_id').notNullable();
      table.integer('version_number').notNullable();
      table.string('content_url', 512).defaultTo(null);
      table.bigInteger('creator_id').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.bigInteger('content_id');
    })
    .createTable('asset_version_metadata_image', table => {
      table.bigInteger('asset_version_id').notNullable().primary();
      table.integer('image_format').notNullable();
      table.integer('resolution_x').notNullable();
      table.integer('resolution_y').notNullable();
      table.integer('size_bytes').notNullable();
      table.string('hash', 64).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('asset_vote', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('asset_id').notNullable();
      table.integer('type').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('collectible_sale_logs', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('asset_id').notNullable();
      table.bigInteger('amount').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })

    .createTable('forum_post', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.string('post', 1024).notNullable();
      table.string('title', 255).defaultTo(null);
      table.bigInteger('thread_id');
      table.integer('sub_category_id').notNullable();
      table.boolean('is_pinned').defaultTo(false).notNullable();
      table.boolean('is_locked').defaultTo(false).notNullable();
      table.bigInteger('views').defaultTo(0).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('forum_post_read', table => {
      table.bigInteger('forum_post_id').notNullable();
      table.bigInteger('user_id').notNullable();
      table.primary(['forum_post_id', 'user_id']);
    })

    .createTable('group', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id');
      table.boolean('locked').defaultTo(false).notNullable();
      table.string('name', 255).notNullable();
      table.string('description', 1024).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('group_audit_log', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('group_id').notNullable();
      table.bigInteger('user_id').notNullable();
      table.integer('action').notNullable();
      table.bigInteger('new_owner_user_id');
      table.bigInteger('old_role_id');
      table.bigInteger('new_role_id');
      table.bigInteger('user_id_range_change');
      table.bigInteger('role_set_id');
      table.integer('old_rank');
      table.integer('new_rank');
      table.string('old_name', 255).defaultTo(null);
      table.string('new_name', 255).defaultTo(null);
      table.string('old_description', 255).defaultTo(null);
      table.string('new_description', 255).defaultTo(null);
      table.string('post_desc', 255).defaultTo(null);
      table.bigInteger('post_user_id');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.bigInteger('fund_recipient_user_id');
      table.bigInteger('currency_amount');
      table.integer('currency_type');
    })
    .createTable('group_economy', table => {
      table.bigInteger('group_id').notNullable().primary();
      table.integer('balance_robux').notNullable();
      table.integer('balance_tickets').notNullable();
    })
    .createTable('group_icon', table => {
      table.bigInteger('group_id').notNullable().primary();
      table.string('name', 255).notNullable();
      table.integer('is_approved').defaultTo(0).notNullable();
      table.bigInteger('user_id');
    })
    .createTable('group_role', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('group_id').notNullable();
      table.string('name', 255).notNullable();
      table.string('description', 255).notNullable();
      table.integer('rank').notNullable();
      table.bigInteger('member_count').defaultTo(0).notNullable();
    })
    .createTable('group_role_permission', table => {
      table.bigInteger('group_role_id').notNullable().primary();
      table.boolean('delete_from_wall').defaultTo(false).notNullable();
      table.boolean('post_to_wall').defaultTo(false).notNullable();
      table.boolean('invite_members').defaultTo(false).notNullable();
      table.boolean('post_to_status').defaultTo(false).notNullable();
      table.boolean('remove_members').defaultTo(false).notNullable();
      table.boolean('view_status').defaultTo(false).notNullable();
      table.boolean('view_wall').defaultTo(false).notNullable();
      table.boolean('change_rank').defaultTo(false).notNullable();
      table.boolean('advertise_group').defaultTo(false).notNullable();
      table.boolean('manage_relationships').defaultTo(false).notNullable();
      table.boolean('add_group_places').defaultTo(false).notNullable();
      table.boolean('view_audit_logs').defaultTo(false).notNullable();
      table.boolean('create_items').defaultTo(false).notNullable();
      table.boolean('manage_items').defaultTo(false).notNullable();
      table.boolean('spend_group_funds').defaultTo(false).notNullable();
      table.boolean('manage_clan').defaultTo(false).notNullable();
      table.boolean('manage_group_games').defaultTo(false).notNullable();
    })
    .createTable('group_settings', table => {
      table.bigInteger('group_id').notNullable().primary();
      table.boolean('approval_required').defaultTo(false).notNullable();
      table.boolean('enemies_allowed').defaultTo(false).notNullable();
      table.boolean('funds_visible').defaultTo(false).notNullable();
      table.boolean('games_visible').defaultTo(false).notNullable();
    })
    .createTable('group_social_link', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('group_id').notNullable();
      table.integer('type').notNullable();
      table.string('url', 255).notNullable();
      table.string('title', 255).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('group_status', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('group_id').notNullable();
      table.bigInteger('user_id').notNullable();
      table.string('status', 255);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('group_user', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('group_role_id').notNullable();
      table.bigInteger('user_id').notNullable();
    })
    .createTable('group_wall', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('group_id').notNullable();
      table.bigInteger('user_id').notNullable();
      table.string('content', 1024).notNullable();
      table.boolean('is_deleted').defaultTo(false).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })

    .createTable('join_application', table => {
      table.string('id', 128).notNullable().primary();
      table.string('preferred_name', 512).notNullable();
      table.string('about', 4096).notNullable();
      table.string('social_presence', 512).notNullable();
      table.bigInteger('user_id');
      table.bigInteger('author_id');
      table.string('reject_reason', 512).defaultTo(null);
      table.integer('status').defaultTo(1).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.string('join_id', 128).defaultTo(null);
      table.timestamp('locked_at');
      table.bigInteger('locked_by_user_id');
      table.boolean('is_verified').defaultTo(false).notNullable();
      table.string('verified_url', 512).defaultTo(null);
      table.string('verified_id', 512).defaultTo(null);
      table.string('verification_phrase', 512).defaultTo(null);
    })

    .createTable('moderation_admin_message', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('actor_id').notNullable();
      table.string('subject', 1024).notNullable();
      table.string('body', 4096).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('moderation_bad_username', table => {
      table.bigInteger('id').notNullable().primary();
      table.string('username', 512).notNullable();
    })
    .createTable('moderation_bad_username_log', table => {
      table.bigInteger('id').notNullable().primary();
      table.string('username', 512).notNullable();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('author_id').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('moderation_ban', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('actor_id').notNullable();
      table.string('reason', 1024).notNullable();
      table.string('internal_reason', 1024);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('expired_at');
    })
    .createTable('moderation_change_join_app', table => {
      table.bigInteger('id').notNullable().primary();
      table.string('application_id', 255).notNullable();
      table.bigInteger('author_user_id').notNullable();
      table.integer('new_status').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('moderation_give_item', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('author_user_id').notNullable();
      table.bigInteger('user_asset_id').notNullable();
      table.bigInteger('user_id_from');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('moderation_give_robux', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('author_user_id').notNullable();
      table.bigInteger('amount').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('moderation_give_tickets', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('author_user_id').notNullable();
      table.bigInteger('amount').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('moderation_manage_asset', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('asset_id').notNullable();
      table.bigInteger('actor_id').notNullable();
      table.integer('action').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('moderation_migrate_asset', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('asset_id').notNullable();
      table.bigInteger('roblox_asset_id').notNullable();
      table.bigInteger('actor_id').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('moderation_modify_asset', table => {
      table.integer('id').notNullable().primary();
      table.bigInteger('asset_id').notNullable();
      table.bigInteger('actor_id').notNullable();
      table.text('old_name').notNullable();
      table.text('new_name').notNullable();
      table.text('old_description');
      table.text('new_description');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('moderation_refund_transaction', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('transaction_id').notNullable();
      table.bigInteger('actor_id').notNullable();
      table.bigInteger('user_id_one').notNullable();
      table.bigInteger('user_id_two').notNullable();
      table.bigInteger('asset_id');
      table.bigInteger('user_asset_id');
      table.bigInteger('amount').notNullable();
      table.integer('currency_type').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('moderation_reset_password', table => {
      table.integer('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('actor_id').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    })
    .createTable('moderation_set_alert', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('actor_id').notNullable();
      table.string('alert', 4096).defaultTo(null);
      table.string('alert_url', 4096).defaultTo(null);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('moderation_unban', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('actor_id').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('moderation_update_product', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('actor_id').notNullable();
      table.bigInteger('asset_id').notNullable();
      table.boolean('is_limited').notNullable();
      table.boolean('is_limited_unique').notNullable();
      table.boolean('is_for_sale').notNullable();
      table.integer('price_in_robux');
      table.integer('price_in_tickets');
      table.integer('max_copies');
      table.timestamp('offsale_at');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('moderation_user_ban', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('author_user_id').notNullable();
      table.string('reason', 255).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('expired_at');
      table.text('internal_reason');
    })

    .createTable('promocodes', table => {
      table.integer('id').notNullable().primary();
      table.string('code', 50).notNullable().unique();
      table.bigInteger('asset_id');
      table.integer('robux_amount');
      table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      table.timestamp('expires_at');
      table.integer('max_uses');
      table.integer('use_count').defaultTo(0).notNullable();
      table.boolean('is_active').defaultTo(true).notNullable();
    })
    .createTable('promocode_redemptions', table => {
      table.integer('id').notNullable().primary();
      table.integer('promocode_id').notNullable().references('id').inTable('promocodes');
      table.bigInteger('user_id').notNullable();
      table.timestamp('redeemed_at').defaultTo(knex.fn.now()).notNullable();
      table.bigInteger('asset_id');
      table.integer('robux_amount');
    })

    .createTable('trade_currency_order', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('start_amount').notNullable();
      table.bigInteger('balance').notNullable();
      table.bigInteger('exchange_rate').notNullable();
      table.integer('source_currency').notNullable();
      table.integer('destination_currency').notNullable();
      table.boolean('is_closed').defaultTo(false).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('closed_at');
    })
    .createTable('trade_currency_log', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('order_id').notNullable();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('source_amount').notNullable();
      table.bigInteger('destination_amount').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })

    .createTable('universe', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('root_asset_id').notNullable();
      table.boolean('is_public').defaultTo(false).notNullable();
      table.bigInteger('creator_id').notNullable();
      table.integer('creator_type').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('universe_asset', table => {
      table.bigInteger('universe_id').notNullable();
      table.bigInteger('asset_id').notNullable();
      table.primary(['universe_id', 'asset_id']);
    })

	.createTable('user', table => {
	  table.bigInteger('id').notNullable().primary().defaultTo(knex.raw('nextval(\'user_id_seq\'::regclass)'));
      table.string('username', 64).notNullable().unique();
      table.string('password', 255).notNullable();
      table.integer('status').defaultTo(1).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.string('description', 1024).defaultTo(null);
      table.timestamp('online_at').notNullable().defaultTo(knex.fn.now());
      table.integer('session_key').defaultTo(0).notNullable();
      table.boolean('is_18_plus').defaultTo(false).notNullable();
      table.timestamp('session_expired_at');
    })
    .createTable('user_asset', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('asset_id').notNullable();
      table.bigInteger('serial');
      table.bigInteger('price').defaultTo(0).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('user_avatar', table => {
      table.bigInteger('user_id').notNullable().primary();
      table.string('thumbnail_url', 255);
      table.integer('avatar_type').defaultTo(1).notNullable();
      table.double('scale_height').defaultTo(1).notNullable();
      table.double('scale_width').defaultTo(1).notNullable();
      table.double('scale_head').defaultTo(1).notNullable();
      table.double('scale_depth').defaultTo(1).notNullable();
      table.double('scale_proportion').defaultTo(0).notNullable();
      table.double('scale_body_type').defaultTo(0).notNullable();
      table.integer('head_color_id').notNullable();
      table.integer('torso_color_id').notNullable();
      table.integer('right_arm_color_id').notNullable();
      table.integer('left_arm_color_id').notNullable();
      table.integer('right_leg_color_id').notNullable();
      table.integer('left_leg_color_id').notNullable();
      table.string('headshot_thumbnail_url', 255).defaultTo(null);
    })
    .createTable('user_avatar_asset', table => {
      table.bigInteger('user_id').notNullable();
      table.bigInteger('asset_id').notNullable();
      table.primary(['user_id', 'asset_id']);
    })
    .createTable('user_badge', table => {
      table.bigInteger('user_id').notNullable();
      table.bigInteger('badge_id').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.primary(['user_id', 'badge_id']);
    })
    .createTable('user_ban', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.bigInteger('author_user_id').notNullable();
      table.string('reason', 255).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('expired_at');
      table.string('internal_reason', 4096).defaultTo(null);
    })
    .createTable('user_conversation', table => {
      table.bigInteger('id').notNullable().primary();
      table.string('title', 255).defaultTo(null);
      table.bigInteger('creator_id').notNullable();
      table.integer('conversation_type').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('user_conversation_message', table => {
      table.string('id', 64).notNullable().primary();
      table.bigInteger('conversation_id').notNullable();
      table.bigInteger('user_id').notNullable();
      table.text('message').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('user_conversation_message_read', table => {
      table.bigInteger('conversation_id').notNullable();
      table.bigInteger('user_id').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.primary(['conversation_id', 'user_id']);
    })
    .createTable('user_conversation_participant', table => {
      table.bigInteger('conversation_id').notNullable();
      table.bigInteger('user_id').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.primary(['conversation_id', 'user_id']);
    })
    .createTable('user_discord_links', table => {
      table.bigInteger('user_id').notNullable().primary();
      table.string('discord_id', 64).notNullable().unique();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('user_economy', table => {
      table.bigInteger('user_id').notNullable().primary();
      table.integer('balance_robux').notNullable();
      table.integer('balance_tickets').notNullable();
    })
    .createTable('user_email', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.string('email', 255).notNullable();
      table.integer('status').defaultTo(1).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('user_following', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id_being_followed').notNullable();
      table.bigInteger('user_id_who_is_following').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('user_friend', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id_one').notNullable();
      table.bigInteger('user_id_two').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('user_friend_request', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id_one').notNullable();
      table.bigInteger('user_id_two').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('user_invite', table => {
      table.string('id', 128).notNullable().primary();
      table.bigInteger('user_id');
      table.bigInteger('author_id');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('user_membership', table => {
      table.bigInteger('user_id').notNullable().primary();
      table.integer('membership_type').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('user_message', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id_from').notNullable();
      table.bigInteger('user_id_to').notNullable();
      table.boolean('is_read');
      table.string('subject', 255).notNullable();
      table.string('body', 8192).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.boolean('is_archived').defaultTo(false).notNullable();
    })
    .createTable('user_outfit', table => {
      table.bigInteger('id').notNullable().primary().unique();
      table.string('name', 255).notNullable();
      table.bigInteger('user_id').notNullable();
      table.string('thumbnail_url', 255);
      table.integer('avatar_type').defaultTo(1).notNullable();
      table.double('scale_height').defaultTo(1).notNullable();
      table.double('scale_width').defaultTo(1).notNullable();
      table.double('scale_head').defaultTo(1).notNullable();
      table.double('scale_depth').defaultTo(1).notNullable();
      table.double('scale_proportion').defaultTo(0).notNullable();
      table.double('scale_body_type').defaultTo(0).notNullable();
      table.integer('head_color_id').notNullable();
      table.integer('torso_color_id').notNullable();
      table.integer('right_arm_color_id').notNullable();
      table.integer('left_arm_color_id').notNullable();
      table.integer('right_leg_color_id').notNullable();
      table.integer('left_leg_color_id').notNullable();
      table.string('headshot_thumbnail_url', 255);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('user_outfit_asset', table => {
      table.bigInteger('outfit_id').notNullable();
      table.bigInteger('asset_id').notNullable();
      table.primary(['outfit_id', 'asset_id']);
    })
    .createTable('user_password_reset', table => {
      table.string('id', 64).notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.integer('status').notNullable();
      table.string('social_url', 1024).notNullable();
      table.string('verification_phrase', 1024).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('user_permission', table => {
      table.bigInteger('user_id').notNullable();
      table.integer('permission').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.primary(['user_id', 'permission']);
    })
    .createTable('user_previous_username', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.string('username', 255).notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('user_settings', table => {
      table.bigInteger('user_id').notNullable().primary();
      table.integer('inventory_privacy').defaultTo(1).notNullable();
      table.integer('theme').defaultTo(1).notNullable();
      table.integer('gender').defaultTo(3).notNullable();
      table.integer('trade_privacy').defaultTo(1).notNullable();
      table.integer('trade_filter').defaultTo(1).notNullable();
      table.integer('private_message_privacy').defaultTo(1).notNullable();
    })
    .createTable('user_status', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id').notNullable();
      table.string('status', 255);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('user_trade', table => {
      table.bigInteger('id').notNullable().primary();
      table.bigInteger('user_id_one').notNullable();
      table.bigInteger('user_id_two').notNullable();
      table.bigInteger('user_id_one_robux');
      table.bigInteger('user_id_two_robux');
      table.integer('status').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('expires_at').notNullable();
    })
    .createTable('user_trade_asset', table => {
      table.bigInteger('trade_id').notNullable();
      table.bigInteger('user_asset_id').notNullable();
      table.bigInteger('user_id').notNullable();
      table.primary(['trade_id', 'user_asset_id']);
    })
    .createTable('user_transaction', table => {
      table.bigInteger('id').notNullable().primary();
      table.integer('type').notNullable();
      table.integer('currency_type').notNullable();
      table.bigInteger('amount').notNullable();
      table.bigInteger('user_id_one').notNullable();
      table.bigInteger('user_id_two').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.bigInteger('asset_id');
      table.bigInteger('user_asset_id');
      table.integer('sub_type');
      table.string('old_username', 255).defaultTo(null);
      table.string('new_username', 255).defaultTo(null);
      table.bigInteger('group_id_one');
      table.bigInteger('group_id_two');
    })

    .raw('CREATE SEQUENCE asset_advertisement_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE asset_advertisement_id_seq OWNED BY asset_advertisement.id')
    .raw('CREATE SEQUENCE asset_comment_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE asset_comment_id_seq OWNED BY asset_comment.id')
    .raw('CREATE SEQUENCE asset_datastore_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE asset_datastore_id_seq OWNED BY asset_datastore.id')
    .raw('CREATE SEQUENCE asset_favorite_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE asset_favorite_id_seq OWNED BY asset_favorite.id')
    .raw('CREATE SEQUENCE asset_icon_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE asset_icon_id_seq OWNED BY asset_icon.id')
    .raw('CREATE SEQUENCE asset_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE asset_id_seq OWNED BY asset.id')
    .raw('CREATE SEQUENCE asset_media_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE asset_media_id_seq OWNED BY asset_media.id')
    .raw('CREATE SEQUENCE asset_play_history_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE asset_play_history_id_seq OWNED BY asset_play_history.id')
    .raw('CREATE SEQUENCE asset_version_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE asset_version_id_seq OWNED BY asset_version.id')
    .raw('CREATE SEQUENCE asset_vote_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE asset_vote_id_seq OWNED BY asset_vote.id')
    .raw('CREATE SEQUENCE collectible_sale_logs_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE collectible_sale_logs_id_seq OWNED BY collectible_sale_logs.id')
    .raw('CREATE SEQUENCE forum_post_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE forum_post_id_seq OWNED BY forum_post.id')
    .raw('CREATE SEQUENCE group_audit_log_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE group_audit_log_id_seq OWNED BY group_audit_log.id')
    .raw('CREATE SEQUENCE group_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE group_id_seq OWNED BY "group".id')
    .raw('CREATE SEQUENCE group_role_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE group_role_id_seq OWNED BY group_role.id')
    .raw('CREATE SEQUENCE group_social_link_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE group_social_link_id_seq OWNED BY group_social_link.id')
    .raw('CREATE SEQUENCE group_status_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE group_status_id_seq OWNED BY group_status.id')
    .raw('CREATE SEQUENCE group_user_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE group_user_id_seq OWNED BY group_user.id')
    .raw('CREATE SEQUENCE group_wall_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE group_wall_id_seq OWNED BY group_wall.id')
    .raw('CREATE SEQUENCE moderation_admin_message_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_admin_message_id_seq OWNED BY moderation_admin_message.id')
    .raw('CREATE SEQUENCE moderation_bad_username_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_bad_username_id_seq OWNED BY moderation_bad_username.id')
    .raw('CREATE SEQUENCE moderation_bad_username_log_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_bad_username_log_id_seq OWNED BY moderation_bad_username_log.id')
    .raw('CREATE SEQUENCE moderation_ban_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_ban_id_seq OWNED BY moderation_ban.id')
    .raw('CREATE SEQUENCE moderation_change_join_app_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_change_join_app_id_seq OWNED BY moderation_change_join_app.id')
    .raw('CREATE SEQUENCE moderation_give_item_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_give_item_id_seq OWNED BY moderation_give_item.id')
    .raw('CREATE SEQUENCE moderation_give_robux_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_give_robux_id_seq OWNED BY moderation_give_robux.id')
    .raw('CREATE SEQUENCE moderation_give_tickets_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_give_tickets_id_seq OWNED BY moderation_give_tickets.id')
    .raw('CREATE SEQUENCE moderation_manage_asset_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_manage_asset_id_seq OWNED BY moderation_manage_asset.id')
    .raw('CREATE SEQUENCE moderation_migrate_asset_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_migrate_asset_id_seq OWNED BY moderation_migrate_asset.id')
    .raw('CREATE SEQUENCE moderation_modify_asset_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_modify_asset_id_seq OWNED BY moderation_modify_asset.id')
    .raw('CREATE SEQUENCE moderation_refund_transaction_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_refund_transaction_id_seq OWNED BY moderation_refund_transaction.id')
    .raw('CREATE SEQUENCE moderation_reset_password_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_reset_password_id_seq OWNED BY moderation_reset_password.id')
    .raw('CREATE SEQUENCE moderation_set_alert_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_set_alert_id_seq OWNED BY moderation_set_alert.id')
    .raw('CREATE SEQUENCE moderation_unban_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_unban_id_seq OWNED BY moderation_unban.id')
    .raw('CREATE SEQUENCE moderation_update_product_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_update_product_id_seq OWNED BY moderation_update_product.id')
    .raw('CREATE SEQUENCE moderation_user_ban_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE moderation_user_ban_id_seq OWNED BY moderation_user_ban.id')
    .raw('CREATE SEQUENCE promocode_redemptions_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE promocode_redemptions_id_seq OWNED BY promocode_redemptions.id')
    .raw('CREATE SEQUENCE promocodes_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE promocodes_id_seq OWNED BY promocodes.id')
    .raw('CREATE SEQUENCE trade_currency_log_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE trade_currency_log_id_seq OWNED BY trade_currency_log.id')
    .raw('CREATE SEQUENCE trade_currency_order_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE trade_currency_order_id_seq OWNED BY trade_currency_order.id')
    .raw('CREATE SEQUENCE universe_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE universe_id_seq OWNED BY universe.id')
    .raw('CREATE SEQUENCE user_asset_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_asset_id_seq OWNED BY user_asset.id')
    .raw('CREATE SEQUENCE user_ban_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_ban_id_seq OWNED BY user_ban.id')
    .raw('CREATE SEQUENCE user_conversation_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_conversation_id_seq OWNED BY user_conversation.id')
    .raw('CREATE SEQUENCE user_email_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_email_id_seq OWNED BY user_email.id')
    .raw('CREATE SEQUENCE user_following_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_following_id_seq OWNED BY user_following.id')
    .raw('CREATE SEQUENCE user_friend_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_friend_id_seq OWNED BY user_friend.id')
    .raw('CREATE SEQUENCE user_friend_request_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_friend_request_id_seq OWNED BY user_friend_request.id')
    .raw('CREATE SEQUENCE user_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_id_seq OWNED BY "user".id')
    .raw('CREATE SEQUENCE user_message_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_message_id_seq OWNED BY user_message.id')
    .raw('CREATE SEQUENCE user_outfit_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_outfit_id_seq OWNED BY user_outfit.id')
    .raw('CREATE SEQUENCE user_previous_username_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_previous_username_id_seq OWNED BY user_previous_username.id')
    .raw('CREATE SEQUENCE user_status_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_status_id_seq OWNED BY user_status.id')
    .raw('CREATE SEQUENCE user_trade_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_trade_id_seq OWNED BY user_trade.id')
    .raw('CREATE SEQUENCE user_transaction_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1')
    .raw('ALTER SEQUENCE user_transaction_id_seq OWNED BY user_transaction.id')
	
    .raw('CREATE INDEX asset_advertisement_target_id_target_type_index ON asset_advertisement (target_id, target_type)')
    .raw('CREATE INDEX asset_advertisement_updated_at_index ON asset_advertisement (updated_at)')
    .raw('CREATE INDEX asset_asset_type_index ON asset (asset_type)')
    .raw('CREATE INDEX asset_comment_asset_id_id_index ON asset_comment (asset_id, id)')
    .raw('CREATE INDEX asset_comment_user_id_index ON asset_comment (user_id)')
    .raw('CREATE INDEX asset_favorite_asset_id_index ON asset_favorite (asset_id)')
    .raw('CREATE INDEX asset_favorite_user_id_index ON asset_favorite (user_id)')
    .raw('CREATE INDEX asset_icon_asset_id_index ON asset_icon (asset_id)')
    .raw('CREATE INDEX asset_is_for_sale_creator_idx ON asset (creator_id, creator_type) WHERE (is_for_sale OR is_limited)')
    .raw('CREATE INDEX asset_is_for_sale_creator_type_idx ON asset (creator_id, creator_type, asset_type) WHERE (is_for_sale OR is_limited)')
    .raw('CREATE INDEX asset_is_limited_index ON asset (is_limited)')
    .raw('CREATE INDEX asset_roblox_asset_id_index ON asset (roblox_asset_id)')
    .raw('CREATE INDEX asset_server_asset_id_index ON asset_server (asset_id)')
    .raw('CREATE INDEX asset_server_id_index ON asset_server (id)')
    .raw('CREATE INDEX asset_server_player_asset_id_index ON asset_server_player (asset_id)')
    .raw('CREATE INDEX asset_server_player_server_id_index ON asset_server_player (server_id)')
    .raw('CREATE INDEX asset_thumbnail_asset_id_index ON asset_thumbnail (asset_id)')
    .raw('CREATE INDEX asset_version_asset_id_index ON asset_version (asset_id)')
    .raw('CREATE INDEX collectible_sale_logs_asset_id_index ON collectible_sale_logs (asset_id)')
    .raw('CREATE INDEX forum_post_id_index ON forum_post (id)')
    .raw('CREATE INDEX forum_post_sub_category_id_id_index ON forum_post (sub_category_id, id)')
    .raw('CREATE INDEX forum_post_subcategory_id ON forum_post (sub_category_id)')
    .raw('CREATE INDEX forum_post_subcategory_id_id_desc ON forum_post (sub_category_id, id DESC)')
    .raw('CREATE INDEX forum_post_thread_id ON forum_post (thread_id) WHERE (thread_id IS NOT NULL)')
    .raw('CREATE INDEX forum_post_thread_id_id_index ON forum_post (thread_id, id)')
    .raw('CREATE INDEX forum_post_user_id_created_at_index ON forum_post (user_id, created_at)')
    .raw('CREATE INDEX group_name_index ON "group" (name)')
    .raw('CREATE INDEX group_role_group_id_index ON group_role (group_id)')
    .raw('CREATE INDEX group_social_link_group_id_index ON group_social_link (group_id)')
    .raw('CREATE INDEX group_status_user_id_index ON group_status (user_id)')
    .raw('CREATE INDEX group_user_group_role_id_id_index ON group_user (group_role_id, id)')
    .raw('CREATE INDEX group_user_id_index ON "group" (user_id)')
    .raw('CREATE INDEX group_user_user_id_index ON group_user (user_id)')
    .raw('CREATE INDEX group_wall_id_idx ON group_wall (group_id, id) WHERE (is_deleted IS FALSE)')
    .raw('CREATE INDEX moderation_bad_username_username_index ON moderation_bad_username (username)')
    .raw('CREATE INDEX trx_user_asset_id_idx ON user_transaction (user_asset_id) WHERE (user_asset_id IS NOT NULL)')
    .raw('CREATE INDEX universe_asset_asset_id_index ON universe_asset (asset_id)')
    .raw('CREATE INDEX universe_asset_universe_id_index ON universe_asset (universe_id)')
    .raw('CREATE INDEX user_asset_asset_id ON user_asset (asset_id)')
    .raw('CREATE INDEX user_asset_asset_id_index ON user_asset (asset_id)')
    .raw('CREATE INDEX user_asset_asset_id_uaid ON user_asset (asset_id, id)')
    .raw('CREATE INDEX user_asset_id_asset_id_index ON user_asset (id, asset_id)')
    .raw('CREATE INDEX user_asset_id_index ON user_asset (id)')
    .raw('CREATE INDEX user_asset_lowest_price_assetid ON user_asset (asset_id, price) WHERE ((price > 0) AND (price IS NOT NULL))')
    .raw('CREATE INDEX user_asset_user_id_index ON user_asset (user_id)')
    .raw('CREATE INDEX user_avatar_asset_user_id_index ON user_avatar_asset (user_id)')
    .raw('CREATE INDEX user_avatar_user_id_index ON user_avatar (user_id)')
    .raw('CREATE INDEX user_badge_user_id_index ON user_badge (user_id)')
    .raw('CREATE INDEX user_ban_author_user_id_index ON user_ban (author_user_id)')
    .raw('CREATE INDEX user_ban_user_id_index ON user_ban (user_id)')
    .raw('CREATE INDEX user_conversation_message_conversation_id_created_at_index ON user_conversation_message (conversation_id, created_at)')
    .raw('CREATE INDEX user_conversation_message_conversation_id_index ON user_conversation_message (conversation_id)')
    .raw('CREATE INDEX user_conversation_participant_conversation_id_index ON user_conversation_participant (conversation_id)')
    .raw('CREATE INDEX user_conversation_participant_user_id_index ON user_conversation_participant (user_id)')
    .raw('CREATE INDEX user_economy_user_id_index ON user_economy (user_id)')
    .raw('CREATE INDEX user_email_user_id_index ON user_email (user_id)')
    .raw('CREATE INDEX user_email_user_id_status_index ON user_email (user_id, status)')
    .raw('CREATE INDEX user_following_user_id_being_followed_index ON user_following (user_id_being_followed)')
    .raw('CREATE INDEX user_following_user_id_who_is_following_index ON user_following (user_id_who_is_following)')
    .raw('CREATE INDEX user_friend_request_user_id_one_index ON user_friend_request (user_id_one)')
    .raw('CREATE INDEX user_friend_request_user_id_two_index ON user_friend_request (user_id_two)')
    .raw('CREATE INDEX user_friend_user_id_one_index ON user_friend (user_id_one)')
    .raw('CREATE INDEX user_friend_user_id_two_index ON user_friend (user_id_two)')
    .raw('CREATE INDEX user_id_index ON "user" (id)')
    .raw('CREATE INDEX user_message_user_id_from_index ON user_message (user_id_from)')
    .raw('CREATE INDEX user_message_user_id_to_index ON user_message (user_id_to)')
    .raw('CREATE INDEX user_outfit_asset_outfit_id_index ON user_outfit_asset (outfit_id)')
    .raw('CREATE INDEX user_outfit_user_id_index ON user_outfit (user_id)')
    .raw('CREATE INDEX user_permission_user_id_index ON user_permission (user_id)')
    .raw('CREATE INDEX user_previous_username_user_id_index ON user_previous_username (user_id)')
    .raw('CREATE INDEX user_previous_username_username_index ON user_previous_username (username)')
    .raw('CREATE INDEX user_settings_user_id_index ON user_settings (user_id)')
    .raw('CREATE INDEX user_status_user_id_index ON user_status (user_id)')
    .raw('CREATE INDEX user_trade_asset_trade_id_index ON user_trade_asset (trade_id)')
    .raw('CREATE INDEX user_trade_user_id_one_index ON user_trade (user_id_one)')
    .raw('CREATE INDEX user_trade_user_id_two_index ON user_trade (user_id_two)')
    .raw('CREATE INDEX user_transaction_asset_type_sub_id ON user_transaction (asset_id) WHERE ((type = 1) AND (sub_type = 1))')
    .raw('CREATE INDEX user_transaction_user_id_one_index ON user_transaction (user_id_one)')
    .raw('CREATE INDEX user_transaction_user_id_two_index ON user_transaction (user_id_two)');
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('abuse_report')
    .dropTableIfExists('asset_advertisement')
    .dropTableIfExists('asset_comment')
    .dropTableIfExists('asset_datastore')
    .dropTableIfExists('asset_favorite')
    .dropTableIfExists('asset_icon')
    .dropTableIfExists('asset_media')
    .dropTableIfExists('asset_package')
    .dropTableIfExists('asset_place')
    .dropTableIfExists('asset_play_history')
    .dropTableIfExists('asset_server')
    .dropTableIfExists('asset_server_player')
    .dropTableIfExists('asset_thumbnail')
    .dropTableIfExists('asset_version')
    .dropTableIfExists('asset_version_metadata_image')
    .dropTableIfExists('asset_vote')
    .dropTableIfExists('asset')
    .dropTableIfExists('collectible_sale_logs')
    .dropTableIfExists('forum_post')
    .dropTableIfExists('forum_post_read')
    .dropTableIfExists('group_audit_log')
    .dropTableIfExists('group_economy')
    .dropTableIfExists('group_icon')
    .dropTableIfExists('group_role_permission')
    .dropTableIfExists('group_role')
    .dropTableIfExists('group_settings')
    .dropTableIfExists('group_social_link')
    .dropTableIfExists('group_status')
    .dropTableIfExists('group_user')
    .dropTableIfExists('group_wall')
    .dropTableIfExists('group')
    .dropTableIfExists('join_application')
    .dropTableIfExists('moderation_admin_message')
    .dropTableIfExists('moderation_bad_username_log')
    .dropTableIfExists('moderation_bad_username')
    .dropTableIfExists('moderation_ban')
    .dropTableIfExists('moderation_change_join_app')
    .dropTableIfExists('moderation_give_item')
    .dropTableIfExists('moderation_give_robux')
    .dropTableIfExists('moderation_give_tickets')
    .dropTableIfExists('moderation_manage_asset')
    .dropTableIfExists('moderation_migrate_asset')
    .dropTableIfExists('moderation_modify_asset')
    .dropTableIfExists('moderation_refund_transaction')
    .dropTableIfExists('moderation_reset_password')
    .dropTableIfExists('moderation_set_alert')
    .dropTableIfExists('moderation_unban')
    .dropTableIfExists('moderation_update_product')
    .dropTableIfExists('moderation_user_ban')
    .dropTableIfExists('promocode_redemptions')
    .dropTableIfExists('promocodes')
    .dropTableIfExists('trade_currency_log')
    .dropTableIfExists('trade_currency_order')
    .dropTableIfExists('universe_asset')
    .dropTableIfExists('universe')
    .dropTableIfExists('user_avatar_asset')
    .dropTableIfExists('user_avatar')
    .dropTableIfExists('user_badge')
    .dropTableIfExists('user_ban')
    .dropTableIfExists('user_conversation_message_read')
    .dropTableIfExists('user_conversation_message')
    .dropTableIfExists('user_conversation_participant')
    .dropTableIfExists('user_conversation')
    .dropTableIfExists('user_discord_links')
    .dropTableIfExists('user_economy')
    .dropTableIfExists('user_email')
    .dropTableIfExists('user_following')
    .dropTableIfExists('user_friend_request')
    .dropTableIfExists('user_friend')
    .dropTableIfExists('user_invite')
    .dropTableIfExists('user_membership')
    .dropTableIfExists('user_message')
    .dropTableIfExists('user_outfit_asset')
    .dropTableIfExists('user_outfit')
    .dropTableIfExists('user_password_reset')
    .dropTableIfExists('user_permission')
    .dropTableIfExists('user_previous_username')
    .dropTableIfExists('user_settings')
    .dropTableIfExists('user_status')
    .dropTableIfExists('user_trade_asset')
    .dropTableIfExists('user_trade')
    .dropTableIfExists('user_transaction')
    .dropTableIfExists('user_asset')
    .dropTableIfExists('user');
};