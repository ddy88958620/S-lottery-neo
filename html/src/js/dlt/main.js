/**
 * Created by caojungang on 14-2-19.
 */
define([
    "text!dlt/sel_stats.tpl",
    "text!dlt/sel_msg.tpl",
    "text!dlt/ball_item.tpl",
    "text!dlt/sel_stats_sh.tpl",
    "text!dlt/sh_rnd_red.tpl",
    "lib/tools",
    "login/art_login",
    "lib/alert",
    "pay/pay",
    "update/common",
    "update/stop_game",
    "lib/userAgreementPopup",
    "lib/game_yl_tips",
    "lib/ls",
    "lib/jstorage",
    "lib/json2"
], function (sel_stats_tpl, sel_msg_tpl, ball_item, sel_stats_sh_tpl, sh_rnd_red_tpl, tools, art_login, dialogAlert, pay, updatePage, stop_game, userAgreementPopup, game_yl_tips,ls,jstorage) {

    if ($("#dlt_ball_list").length == 0 || stop_game() == 0) return function () {
    };

    // 更新页面数据
    updatePage();
    // 遗漏 最大遗漏 tip
    game_yl_tips();
    jstorage();
    var isLogin = tools.isLogin;

    var Alert = dialogAlert("提示");

    // $("#dlt_ball_list .ball-count input[type=checkbox]") ie7 有时候 undefined fk
    var $addinput = $("#dltAdd");

    var toNav = new tools.tabToggle({
        $t: $("#toggle_t_dlt li"),
        $c: $(".toggle_c")
    })

    var BallModel = Backbone.Model.extend();

    // 普通玩法
    var Balls = Backbone.Collection.extend({
        model: BallModel,
        initialize: function () {

        },
        count: function () {
            // 统计
            var redNum = this.ball("red").length;
            var blueNum = this.ball("blue").length;
            // todo 和双色球不一样
            //var count = (redNum > 5 && blueNum > 0) ? tools.c(redNum, 6) * blueNum : 0;

            var count = (redNum > 4 && blueNum > 1) ? tools.c(redNum, 5) * tools.c(blueNum, 2) : 0;
            return {
                redNum: redNum,
                blueNum: blueNum,
                count: count,
                add: $addinput.prop("checked") ? count : 0
            }
        },
        ball: function (color) {
            return this.where({color: color})
        },
        done: function () {
            return this.where({done: true})
        },
        toArr: function (color) {
            var arr = color == "red" || color == "blue" ? this.ball(color) : this.done();
            return _.map(arr, function (model) {
                return +model.get("number")
            })
        }
    });

    var BallView = Backbone.View.extend({
        events: {
            "click": "render"
        },
        initialize: function () {
            this.models = balls; // 保存集合
            this.listenTo(this.model, "change", this.render);
            this.listenTo(this.model, "destroy", this.render);
        },
        render: function () {
            var done = this.model.get("done"); // 选中标识
            if (done) {
                this.$el.removeClass("active");
                this.models.remove(this.model)
            } else {
                this.$el.addClass("active");
                this.models.add(this.model)
            }
            this.model.set("done", !done, {silent: true});

        }
    });

    var PtPlayView = Backbone.View.extend({
        el: "#dlt_pt_play",
        upModel: null,
        template: _.template(sel_stats_tpl),
        msgTemplate: _.template(sel_msg_tpl),
        events: {
            "click .clear": "clear",
            "click .rndBtn": "rnd",
            "change select": "rnd",
            "click .selSubmitBtn": "submit",
            "click .blueAll": "blueAll"
        },
        initialize: function () {
            var _this = this;

            this.models = balls;
            this.lists = lists;
            this.$balls = this.$(".ball em");
            this.$stats = this.$(".sel-info");
            this.$submitBtn = this.$(".selSubmitBtn");
            this.$blueAll = this.$(".blueAll");
            // 保存每个球的view
            this.redHash = {}; // 保存每个球的view
            this.blueHash = {};
            this.$balls.each(function (i, el) {
                var data = $.parseJSON($(el).attr("data-model"));
                var hash = data.color == "red" ? _this.redHash : _this.blueHash;
                hash[data.number] = new BallView({
                    model: new BallModel(data),
                    el: el
                })
            });
            // 监听集合变化
            this.listenTo(this.models, "add", this.render);
            this.listenTo(this.models, "remove", this.render);

            // 随机original todo 和双色球不一样

            this.red_original = _.range(1, 36);
            this.blue_original = _.range(1, 13);

            //
            this.redSelect = this.$(".red-n");
            this.blueSelect = this.$(".blue-n");
        },
        rnd: function (e, n) {
            var color, original, hash;
            if (e == "red" || e == "blue") {
                color = e;
            } else {
                color = $(e.currentTarget).attr("data-color")
            }
            n || (n = (color == "red") ? this.redSelect.val() : this.blueSelect.val());
            original = (color == "red") ? this.red_original : this.blue_original;
            hash = (color == "red") ? this.redHash : this.blueHash;
            this.clear(color);
            _
                .chain(original)
                .sample(n)
                .each(function (v) {
                    hash[v].render()
                });
            return false
        },
        clear: function (e) {
            var color;
            if (e == "red" || e == "blue" || e == "all") {
                color = e;
            } else {
                color = $(e.currentTarget).attr("data-color")
            }
            var arr = (color == "red" || color == "blue") ? this.models.ball(color) : this.models.done();
            _.invoke(arr, "destroy");
            this.$blueAll.data("st", 0).html("全选");
            return false
        },
        submit: function () {
            var models = this.models;
            var redNum = models.ball("red").length;
            var blueNum = models.ball("blue").length;
            // todo 和双色球不一样
            if (redNum < 5 || blueNum < 2) {
                var msgText = this.msgTemplate({
                    redNum: redNum,
                    blueNum: blueNum
                });
                Alert.show(function () {
                    this.$(".txt-center").html(msgText);
                });
                return false
            }
            var _this = this;
            var data = {
                red: _.sortBy(_this.models.toArr("red")),
                blue: _.sortBy(_this.models.toArr("blue")),
                // todo 和双色球不一样
                count: tools.c(redNum, 5) * tools.c(blueNum, 2),
                done: true
            };
            if (this.upModel) {
                // 修改
                data.t = +new Date;
                this.upModel.set(data)
                this.upModel = null
            } else {
                // 添加
                this.lists.add(data, {upview: ptPlayView})
            }
            this.toggle();
            this.clear("all");
            return false
        },
        blueAll: function () {
            var st = this.$blueAll.data("st");
            if (st) {
                this.clear("blue")
            } else {
                // todo 和双色球不一样
                this.rnd("blue", 12);
                this.$blueAll.data("st", 1).html("全清")
            }
            return false
        },
        render: function () {
            // 更新view
            this.$stats.html(this.template(this.models.count()))
        },
        toggle: function () {
            this.$submitBtn.html(this.upModel ? "确认修改" : "确认选号")
        }
    });

    // 胆拖
    var DtBalls = Backbone.Collection.extend({
        model: BallModel,
        initialize: function () {

        },
        count: function () {
            // 统计
            var redNum = this.ball("red").length;
            var blueNum = this.ball("blue").length;
            var red_dmNum = this.ball("red_dm").length;
            var blue_dmNum = this.ball("blue_dm").length;


            var bluen = blue_dmNum ? blue_dmNum * blueNum : tools.c(blueNum, 2)
            var count = (red_dmNum > 0 && (redNum + red_dmNum) > 4 && (blueNum + blue_dmNum) > 1) ?
                tools.c(redNum, 5 - red_dmNum) * bluen : 0;
            return {
                redNum: redNum,
                blueNum: blueNum,
                red_dmNum: red_dmNum,
                blue_dmNum: blue_dmNum,
                count: count,
                add: $addinput.prop("checked") ? count : 0
            }
        },
        ball: function (color) {
            return this.where({color: color})
        },
        done: function () {
            return this.where({done: true})
        },
        toArr: function (color) {
            // todo 和双色球不一样
            var arr = (color == "red" || color == "blue" || color == "red_dm" || color == "blue_dm") ? this.ball(color) : this.done();
            return _.map(arr, function (model) {
                return +model.get("number")
            })
        }
    });

    var DtBallView = Backbone.View.extend({
        // todo 多余的双色球对应可以去掉
        //template: _.template(sel_stats_tpl),
        events: {
            "click": "render"
        },
        initialize: function () {
            this.models = dtBalls; // 保存集合
            this.listenTo(this.model, "change", this.render);
            this.listenTo(this.model, "destroy", this.render);
        },
        render: function () {
            var model = this.model;
            var models = this.models;
            var map = this.map;
            var done = model.get("done");// 选中标识
            var color, dmLen;

            if (done) {
                this.$el.removeClass("active");
                map && map.$el.removeClass("libgred");
                models.remove(model);
            } else {
                color = model.get("color");
                if (color == "red_dm") { // 减少where查询
                    dmLen = models.ball("red_dm").length;
                    if (dmLen > 3) {
                        Alert.show(function () {
                            this.$(".txt-center").html("最多只能选4个前区胆码");
                        });
                        return
                    }
                }
                // todo 不双色球不一样（新增）
                if (color == "blue_dm") { // 减少where查询
                    dmLen = models.ball("blue_dm").length;
                    if (dmLen > 0) {
                        Alert.show(function () {
                            this.$(".txt-center").html("最多只能选1个后区胆码");
                        });
                        return
                    }
                }
                if (map && map.model.get("done")) {
                    map.$el.removeClass("active");
                    models.remove(map.model)
                    map.model.set("done", false, {silent: true })
                }
                models.add(this.model);
                // todo 可以精简 => this.el.className = "active"
                this.$el.addClass("active");
                this.$el.removeClass("libgred");
                map && map.$el.addClass("libgred");
            }
            model.set("done", !done, {silent: true});
        }
    });

    var DtPtPlayView = Backbone.View.extend({
        el: "#dlt_dt_play",
        upModel: null,
        events: {
            "click .clear": "clear",
            "click .selSubmitBtn": "submit"
        },
        template: _.template(sel_stats_tpl),
        initialize: function () {
            //var _this = this;

            this.models = dtBalls;
            this.lists = lists;
            this.$balls = this.$(".ball em");
            this.$stats = this.$(".sel-info");
            this.$submitBtn = this.$(".selSubmitBtn");
            // 保存每个球的view
            // todo 和双色球不一样
            var redHash = this.redHash = {}; // 保存每个球的view
            var blueHash = this.blueHash = {};
            var redDmHash = this.redDmHash = {};
            var blueDmHash = this.blueDmHash = {};
            this.$balls.each(function (i, el) {
                var data = $.parseJSON($(el).attr("data-model"));
                var hash = data.color == "red" ? redHash :
                    (data.color == "red_dm") ? redDmHash :
                        (data.color == "blue_dm") ? blueDmHash : blueHash;
                hash[data.number] = new DtBallView({
                    model: new BallModel(data),
                    el: el
                });
            });
            // 缓存对应关系
            _.each(redHash, function (v, k, o) {
                o[k].map = redDmHash[k];
                redDmHash[k].map = o[k]
            })
            // todo 大乐透新增篮球胆码
            _.each(blueHash, function (v, k, o) {
                o[k].map = blueDmHash[k];
                blueDmHash[k].map = o[k]
            })
            this.listenTo(this.models, "add", this.render);
            this.listenTo(this.models, "remove", this.render);
        },
        clear: function () {
            var arr = this.models.done();
            _.invoke(arr, "destroy");
            return false
        },
        submit: function () {
            //todo 和双色球不一样
            var models = this.models;
            var redNum = models.ball("red").length;
            var red_dm_n = models.ball("red_dm").length;
            var blueNum = models.ball("blue").length;
            var blue_dm_n = models.ball("blue_dm").length;
            if (red_dm_n == 0) {
                Alert.show(function () {
                    this.$(".txt-center").html("请至少选取1个前区胆码");
                });
                return false
            }
            if (redNum == 0) {
                Alert.show(function () {
                    this.$(".txt-center").html("请至少选取1个前区拖码");
                });
                return false
            }
            if ((red_dm_n + redNum) < 6) {
                Alert.show(function () {
                    this.$(".txt-center").html("前区胆码+前区拖码>=6个");
                });
                return false
            }

            // if (blueNum < 2 && blue_dm_n == 0) {
            //     Alert.show(function () {
            //         this.$(".txt-center").html("请至少选取1个后区胆码");
            //     });
            //     return false
            // }

            if (blueNum < 2) {
                Alert.show(function () {
                    this.$(".txt-center").html("请至少选取2个后区拖码");
                });
                return false
            }


            var count = tools.c(redNum, (5 - red_dm_n)) * tools.c(blueNum, (2 - blue_dm_n));


            var _this = this;

            var data = {
                red: _.sortBy(_this.models.toArr("red")),
                blue: _.sortBy(_this.models.toArr("blue")),
                red_dm: _.sortBy(_this.models.toArr("red_dm")),
                blue_dm: _.sortBy(_this.models.toArr("blue_dm")),
                count: count,
                done: true
            };
            if (this.upModel) {
                // 修改
                data.t = +new Date;
                this.upModel.set(data)
                this.upModel = null
            } else {
                // 添加
                this.lists.add(data, {upview: dtPlayView})
            }
            this.toggle();
            this.clear();
            return false
        },
        render: function () {
            // 更新view
            this.$stats.html(this.template(this.models.count()))
        },
        toggle: function () {
            this.$submitBtn.html(this.upModel ? "确认修改" : "确认选号")
        }
    });

    // 杀号定胆
    var ShBalls = Backbone.Collection.extend({
        model: BallModel,
        msg: 0,
        initialize: function () {

        },
        count: function () {
            // 统计


        },
        ball: function (color) {
            return this.where({color: color})
        },
        done: function () {
            return this.filter(function (model) {
                var done = model.get("done");
                return done == 1 || done == 2
            })
        },
        toArr: function (color) {
            var arr = color ? this.ball(color) : this.done();
            return _.map(arr, function (model) {
                return +model.get("number")
            })
        }
    });

    var ShBallView = Backbone.View.extend({
        template: _.template(sel_stats_tpl),
        events: {
            "click": "render"
        },
        initialize: function () {
            this.models = shBalls; // 保存集合
            this.listenTo(this.model, "change", this.render);
            this.listenTo(this.model, "destroy", this.clear);
        },
        render: function () {

            //         红拖码 蓝拖码 红胆码   蓝胆码    红杀号   蓝杀号
            // color : red  blue red_dm blue_dm red_sh blue_sh
            // done 0 拖码 1胆码 2杀号

            var model = this.model;
            var models = this.models;
            // 集合
            var red = models.ball("red");
            var blue = models.ball("blue");
            var red_dm = models.ball("red_dm");
            var blue_dm = models.ball("blue_dm");
            var red_sh = models.ball("red_sh");
            var blue_sh = models.ball("blue_sh");

            var done = model.get("done") || 0;
            var color = model.get("color");

            // 红球区 篮球区
            var isRed = (color == "red" || color == "red_dm" || color == "red_sh");
            var isBlue = (color == "blue" || color == "blue_dm" || color == "blue_sh");

            // todo 和双色球不一样
            // 红球 胆码+杀号>33 => 什么都不做

            if (isRed && done == 0 && (red_dm.length + red_sh.length) > 33) {
                return
            }

            // 红球胆码大于3 => 提示1次
            if (isRed && done == 0 && red_dm.length > 3) {
                !models.msg && (Alert.show(function () {
                    this.$(".txt-center").html("前区最多定4个胆码");
                }));
                !models.msg && (models.msg = 1);
                //  跳过胆码
                done = 1
            }

            // 红球杀号大于28
            if (isRed && done == 1 && red_sh.length > 28) {
                // 跳过杀号
                done = 2
            }


            // 篮球大于9
            if (isBlue && done == 1 && blue_sh.length > 9) {
                // 跳过杀号
                done = 2
            }


            if (done == 0) {// 0 => 1 => 2 => 0
                model.set({
                    color: isRed ? "red_dm" : "blue_dm",
                    done: 1
                }, {silent: true});
                this.el.className = "active";
                this.models.add(model)
            } else if (done == 1) {
                model.set({
                    color: isRed ? "red_sh" : "blue_sh",
                    done: 2
                }, {silent: true});
                this.el.className = "disable";
                this.models.add(model)
            } else if (done == 2) {
                model.set({
                    color: isRed ? "red" : "blue",
                    done: 0
                }, {silent: true});
                this.el.className = "";
                this.models.remove(model)
            }
            shPlayView.upSelect();
            shPlayView.upStats()

        },
        addOne: function (className, done, color) {
            this.model.set({
                "done": done,
                "color": color
            }, {silent: true});
            this.el.className = className;
            done == 2 && (this.models.remove(this.model, {silent: true}));
            this.models.add(this.model)

        },
        clear: function () {
            // 触发 render
            this.model.set({
                done: 2,
                t: +new Date
            });

        }
    });

    var ShPtPlayView = Backbone.View.extend({
        el: "#dlt_sh_play",
        upModel: null,
        events: {
            "click .clear": "clear",
            "click .blueAll": "blueAll",
            "click .selSubmitBtn": "submit",
            "change .sel-redn": "upStats",
            "change .sel-bluen": "upStats",
            "change .sel-mul": "upStats"
        },
        template: _.template(sel_stats_sh_tpl),
        initialize: function () {
            //var _this = this;

            this.models = shBalls;
            this.lists = lists;
            this.$balls = this.$(".ball em");
            this.$stats = this.$(".sel-info");
            this.$selredn = this.$(".sel-redn");
            this.$selbluen = this.$(".sel-bluen");
            this.$selmul = this.$(".sel-mul");
            this.$submitBtn = this.$(".selSubmitBtn");
            this.$blueAll = this.$(".blueAll");
            // 保存每个球的view
            var redHash = this.redHash = {}; // 保存每个球的view
            var blueHash = this.blueHash = {};
            this.$balls.each(function (i, el) {
                var data = $.parseJSON($(el).attr("data-model"));
                var hash = data.color == "red" ? redHash : blueHash;
                hash[data.number] = new ShBallView({
                    model: new BallModel(data),
                    el: el
                });
            });

            // 随机original
            this.red_original = _.range(1, 36);
            this.blue_original = _.range(1, 13);


            // this.listenTo(this.models, "add", this.render);
            // this.listenTo(this.models, "remove", this.render);
            this.upStats()
        },
        clear: function (e) {
            e || (e = "all");
            var color = e.currentTarget ? $(e.currentTarget).attr("data-color") : e;
            var arr = (color == "all") ? this.models.done() : this.models.ball(color);
            _.invoke(arr, "destroy");
            this.$blueAll.data("st", 0).html("全选");
            return false
        },
        submit: function () {
            var redNum = +this.$selredn.val();
            var blueNum = +this.$selbluen.val();
            var mul = +this.$selmul.val();

            var red_dm = this.models.toArr("red_dm");
            var red_sh = this.models.toArr("red_sh");
            var blue_dm = this.models.toArr("blue_dm");
            var blue_sh = this.models.toArr("blue_sh");

            // 过滤胆码拖码
            var red_range = _.difference(this.red_original, red_sh, red_dm);
            var blue_range = _.difference(this.blue_original, blue_sh, blue_dm);

            var red_rndn = redNum - red_dm.length;
            var blue_rndn = blueNum - blue_dm.length;

            var red, blue, data;
            for (var i = mul; i--;) {
                red = _.sample(red_range, red_rndn);
                blue = _.sample(blue_range, blue_rndn).concat(blue_dm);
                data = {
                    red: _.sortBy(red),
                    blue: _.sortBy(blue),
                    red_dm: _.sortBy(red_dm),
                    count: tools.c(red.length, (5 - red_dm.length)) * tools.c(blue.length, 2),
                    done: true
                };
                if (this.upModel) {
                    // 修改
                    data.t = +new Date;
                    this.upModel.set(data)
                    this.upModel = null
                } else {
                    // 添加
                    this.lists.add(data, {
                        upview: (red_dm.length > 0) ? dtPlayView : ptPlayView
                    })
                }

            }

            this.clear();


            return false
        },
        rnd: function (original, disable, n) {
            return _.sample(_.difference(original, disable), n)
        },
        blueAll: function () {
            var st = this.$blueAll.data("st");
            if (st) {
                this.clear("blue_dm")
            } else {
                _.each(this.blueHash, function (view) {
                    // 设置 done =0 view.render里会done=1
                    view.model.set({
                        done: 0,
                        t: +new Date
                    })
                });
                this.$blueAll.data("st", 1).html("全清")
            }
            this.upSelect();
            this.upStats()

            return false
        },
        rnd_red_tpl: _.template(sh_rnd_red_tpl),
        upSelect: function () {
            // 更新view
            // todo 和双色球不一样的id
            var $selredn = this.$selredn;
            var $selbluen = this.$selbluen;
            var red_sh = this.models.ball("red_sh").length;
            var red_dm = this.models.ball("red_dm").length;
            var blue_sh = this.models.ball("blue_sh").length;
            var blue_dm = this.models.ball("blue_dm").length;

            var red_n = 6;
            var red_v = $selredn.val();
            var red_len = 25;

            // if ((red_sh + red_dm) > 9) {
            //     red_len = (35 - (red_sh + red_dm))
            // }
            if (red_sh > 10) {
                red_len = red_len - (red_sh - 10)
            }

            var blue_n = (blue_dm < 2) ? 2 : blue_dm;
            var blue_v = $selbluen.val();
            var blue_len = 12 - blue_sh;


            $selredn.html(this.rnd_red_tpl({n: red_n, v: red_v, len: red_len}))
            $selbluen.html(this.rnd_red_tpl({n: blue_n, v: blue_v, len: blue_len}))
        },
        upStats: function () {
            var redNum = this.$selredn.val();
            var red_dm = this.models.ball("red_dm").length;
            var blueNum = this.$selbluen.val();
            var mul = this.$selmul.val();
            var count = tools.c(redNum - red_dm, 5 - red_dm) * tools.c(blueNum, 2) * mul;
            this.$stats.html(this.template({
                count: count,
                add: $addinput.prop("checked") ? count : 0
            }))
        },
        toggle: function () {
            this.$submitBtn.html(this.upModel ? "确认修改" : "确认选号")
        }
    });

    /*=========================================================================================================*/

    var Lists = Backbone.Collection.extend({
        model: BallModel,
        done: function () {
            return this.where({done: true})
        },
        count: function () {
            return _.reduce(this.models, function (memo, model) {
                return memo + model.get("count")
            }, 0);
        }
    });

    var Item = Backbone.View.extend({
        tagName: "li",
        template: _.template(ball_item),
        events: {
            "click .edit": "update",
            "click .del": "destroy"
        },
        initialize: function () {
            this.listenTo(this.model, 'destroy', this.remove);
            this.listenTo(this.model, 'change', this.render);
        },
        update: function () {
            // 更新ui
            this.$el.addClass("libgred");
            this.$el.siblings().removeClass("libgred");

            // 修改
            var upview = this.upview;
            upview.upModel = this.model;
            upview.toggle();

            // 渲染
            upview.clear("all");
            _.each(this.model.get("red"), function (n) {
                upview.redHash[+n].render()
            });
            _.each(this.model.get("blue"), function (n) {
                upview.blueHash[+n].render()
            });
            _.each(this.model.get("red_dm"), function (n) {
                upview.redDmHash[+n].render()
            });
            // todo 和双色球不一样 篮球胆码
            _.each(this.model.get("blue_dm"), function (n) {
                upview.blueDmHash[+n].render()
            });
            // 切换对应tab
            if (upview == ptPlayView) {
                toNav.to(0)
            } else if (upview == dtPlayView) {
                toNav.to(1)
            }
            return false
        },
        render: function () {
            var data = this.model.toJSON();
            // 1 => 01
            data = $.extend(true, {}, data); //
            _.each(data, function (arr) {
                _.each(arr, function (v, k) {
                    var str = (v < 10) ? "0" : "";
                    arr[k] = str + +v
                })
            });
            data.add = $addinput.prop("checked") ? true : false;
            this.$el.html(this.template(data));
            this.$el.removeClass("libgred");
            ballsView.render(); // 更新统计
            return this
        },
        destroy: function () {
            this.model.destroy();
            var upview = this.upview;

            if (upview.upModel == this.model) { // 是否删除当前修改
                upview.upModel = null;
                upview.toggle();
                upview.clear("all");
            }

            ballsView.render(); // 更新统计
            return false
        }
    });

    var BallsView = Backbone.View.extend({
        el: "#dlt_ball_list",
        events: {
            "click .rndBtn": "rnd",
            "click .clear": "clear",
            "keyup .mul": "checkInput",
            "keyup .rnd_n": "checkInput",
            "blur .mul": "blurInput",
            "blur .rnd_n": "blurInput",
            "click #ballSubmit": "submit",
            "click .ball-count input[type=checkbox]": "add", //追加
            "click .read_protocal": "popupProtocal"
        },
        popupProtocal: function () {
            userAgreementPopup("agentProtocal", "用户委托投注协议");
            return false;
        },
        initialize: function () {
            this.$rnd_n = this.$(".rnd_n");
            this.$parent = this.$("#item_parent");
            this.$read = this.$(".ball-submit input[type='checkbox']");
            // 集合
            this.models = lists;
            // 随机original todo 和双色球不一样
            this.red_original = _.range(1, 36);
            this.blue_original = _.range(1, 13);

            // 更新统计
            this.$mul = this.$(".mul");
            this.$count = this.$(".count");
            this.$money = this.$(".money");

            this.listenTo(this.models, "add", this.addOne);

            // tips
            this.$rndTips = this.$(".ball-item .ball-list-tips");
            var $payMethodTips = this.$(".ball-pay-method .ball-list-tips");
            var $addTips = this.$(".ball-count .ball-list-tips");
            this.$(".ball-pay-method .tips i").hover(function () {
                $payMethodTips.show()
            }, function () {
                $payMethodTips.hide()
            });
            $addTips.find(".close").on("click",function(){
            	$(this).closest(".ball-list-tips").hide();
            	$.cookie("zj_bets","1");
            });
            if($.cookie("zj_bets")==undefined||$.cookie("zj_bets")==""||$.cookie("zj_bets")==null){
            	$addTips.show();
            }
            this.$(".ball-count i").hover(function () {
                $addTips.show()
            }, function () {
                $addTips.hide()
            });
            this.$rndTips.css({position:"absolute",display:"block"});
        },
        rnd: function (e) {
            var n = $(e.currentTarget).attr("data-n") || this.$rnd_n.val();
            for (var i = 0; i < n; i++) {
                this.models.add(
                    {
                        // todo 和双色球不一样
                        red: _.sortBy(_.sample(this.red_original, 5)),
                        blue: _.sortBy(_.sample(this.blue_original, 2)),
                        done: true,
                        count: 1 // 随机都是1
                    },
                    {
                        upview: ptPlayView
                    }
                );
            }
            this.$rndTips.hide();
            var _scrollTarget = $(".cp-sub-nav");
            if(!_scrollTarget.data("onceScroll")){
            	tools.scrollToDom(".cp-infos");
            	_scrollTarget.data("onceScroll",1);
            }
            return false

        },
        addOne: function (model, models, options) {
            var view = new Item({model: model });
            view.upview = options.upview;
            this.$parent.prepend(view.render().el);
        },
        clear: function () {
            _.invoke(this.models.done(), "destroy");
            this.render()
            return false
        },
        render: function () {
            var count = lists.count();
            var add = $addinput.prop("checked") ? 1 : 0;
            this.$money.html(count * this.$mul.val() * (2 + add));
            this.$count.html(count)
            //console.log(count,this.$mul.val())
        },
        add: function () {
            var add = $addinput.prop("checked") ? true : false;
            this.models.each(function (model) {
                model.set("add", add)
            });
            ptPlayView.render();
            dtPlayView.render();
            shPlayView.upStats()
        },
        blurInput: function (e) {
            var $this = $(e.currentTarget);
            var v = $.trim($this.val());
            (v == 0) && $this.val(1);
            this.render()
        },
        checkInput: function (e) {
            var $this = $(e.currentTarget);
            var v = $.trim($this.val());
            if (v == 0) {
                $this.val("")
            } else if (v > 99) {
                $this.val(99)
            } else if (v.length == 1) {
                $this.val(v.replace(/[^1-9]/g, ''))
            } else {
                $this.val(v.replace(/\D/g, ''))
            }
            this.render()
        },
        pad: function (v) {
            if (!v) return;
            var i;
            for (i = v.length; i--;) {
                v[i] = v[i].toString().length == 1 ? "0" + v[i] : v[i]
            }
        },
        submit: function () {
            var _this = this;
            if (this.models.models.length == 0) {
                Alert.show(function () {
                    this.$(".txt-center").html("请先选取投注号码");
                })
                return false
            }

            if (!this.$read.prop("checked")) {
                Alert.show(function () {
                    this.$(".txt-center").html("请先阅读并同意\u300a用户委托投注协议\u300b");
                });
                return false
            }
             
           
            isLogin(function () {
                // 已登陆
                pay.call(_this, "dlt")
            }, function () {
                // 未登录
            	var  dataObj = ls.call(_this,"dlt");
            	 if(!!dataObj.data && tools.getBytes(dataObj.data)<=30*1024){
            		dataObj.timestamp = +new Date;             		              		
            		var data = JSON.stringify(dataObj); 
            		$.jStorage.set("betsData",data); 
            		//$.jStorage.setTTL("betsData",60000);
            	 }
                art_login.show(function () {
                    this.successCallfn = function () {
                        this.hide();
                        pay.call(_this, "dlt")
                    }
                })
            })
            return false
        }
    });

    /*==========================================================================================================*/

    // list
    var lists = new Lists;
    var ballsView = new BallsView;


    // 普通玩法
    var balls = new Balls;
    var ptPlayView = new PtPlayView;

    // 胆拖
    var dtBalls = new DtBalls;
    var dtPlayView = new DtPtPlayView;

    // 杀号定胆
    var shBalls = new ShBalls;
    var shPlayView = new ShPtPlayView;


    // 投注

    (function () {

    	var outerData = $("#defaultBets").val();
    	var fillData = function(data) {
            var list = data.split(";");
            if (list[0].slice(0, 1) == "+") {
                $addinput.prop("checked", true);
            }
            for (var i = 0,
            len = list.length; i < len; i++) {
                var arr = list[i].split("#");
                var ballArr = arr[0].split(":");
                var redBallArr = ballArr[0].split("$");
                var redDmArr = redBallArr.length == 2 ? redBallArr[0].split(" ") : [];
                var redArr = redBallArr.length == 2 ? redBallArr[1].split(" ") : redBallArr[0].split(" ");
                var blueBallArr = ballArr[1].split("$");
                var blueDmArr = blueBallArr.length == 2 ? blueBallArr[0].split(" ") : [];
                var blueArr = blueBallArr.length == 2 ? blueBallArr[1].split(" ") : blueBallArr[0].split(" ");
                var mul = arr[1];

                lists.add({
                    red: _.sortBy(redArr),
                    red_dm: _.sortBy(redDmArr),
                    blue: _.sortBy(blueArr),
                    blue_dm: _.sortBy(blueDmArr),
                    done: true,
                    count: tools.c(redArr.length, (5 - redDmArr.length)) * tools.c(blueArr.length, (2 - blueDmArr.length)),
                    add: 0
                },
                {
                    upview: (redDmArr.length > 0 || blueDmArr.length > 0) ? dtPlayView: ptPlayView
                });
            }
            $("#dlt_ball_list .mul").val(mul); // 倍数都一样
            ballsView.render();
            $.jStorage.flush();
        };
    	
        isLogin(function(userId) {
            if (userId.indexOf("qq.sohu.com") > -1 && $.jStorage.index().length > 0) {
                var dataObj = $.jStorage.get("betsData");
                dataObj = JSON.parse(dataObj);
                if (Math.abs( + new Date - ( + dataObj.timestamp)) > 60 * 1000) { //  $.jStorage.getTTL("betsData")<0
                    $.jStorage.flush();
                } else if (dataObj && dataObj.gameId === "dlt") {
                    fillData(dataObj.data);
                }
            } else if (outerData) {
                fillData(outerData);
                tools.scrollToDom(".cp-infos")
            }
        },
        function() { //login not yet
            $.jStorage.flush();
            if (outerData) {
                fillData(outerData);
                tools.scrollToDom(".cp-infos")
            }
        });
        
    })();
    return function () {

    }
})