function Controller() {
    var self = this;

    self.data = new Hier();
    self.dropBox = null;

    self._getHierPath = function(obj) {
        obj = $(obj);
        var path = obj.data('dd-id');
        if (obj.data('dd-index') != null) {
            path += '[' + obj.data('dd-index') + ']'
        }
        // Up one step
        obj = obj.parent();
        if (obj.length > 0) {
            obj = obj.closest('[data-dd-id]');
        }
        if (obj.length > 0) {
            path = self._getHierPath(obj) + '.' + path;
        }
        return path;
    };

    self._allControls = function() {
        return $('.form-control[data-dd-path]');
    };

    self._setupDDPaths = function(objs=$) {
        $(objs).find('.form-control[data-dd-id]:not([data-dd-array="master"] *)')
            .each(function (idx, obj) {
                $(obj).attr('data-dd-path', self._getHierPath(obj));
            });
    };

    self._setupDropBox = function() {
        if (DDConfig && DDConfig['accessToken']) {
            self.dropBox = new Dropbox({accessToken: DDConfig['accessToken']});
        } else {
            self.notify('danger', 'Unable to load DropBox: missing \'accessToken\' entry in \'dd-config.js\'');
        }
    };

    self._setupSaveToModal = function() {
        self._modalSaveTo = $('#save_to');
        var save_to_list = self._modalSaveTo.find('.dropbox-file-list');
        var save_to_form = self._modalSaveTo.find('form');
        var save_to_file = save_to_form.find('input');

        save_to_form.on('submit', function (event) {
            // TODO this is not correct
            event.preventDefault();
            event.stopPropagation();
            if (save_to_form[0].checkValidity() === true) {
                self._modalSaveTo.modal('hide');
                self.toggleWaiting(true);
                self.save(save_to_form.find('input').val(), function(res) { self.toggleWaiting(false, res); });
            }
            save_to_form.addClass('was-validated');
        });

        self._modalSaveTo.on('show.bs.modal', function (event) {
            var event_fn = function(event2) {
                save_to_file.val($(this).text().trim()).change();
            };
            save_to_form[0].reset();
            save_to_form.removeClass('was-validated');
            self._populateFileList(save_to_list, event_fn);
        });
    };

    self._setupAnimatedChevrons = function() {
        // Find all the chevron buttons
        $('div.card div.card-header button.close i.fa').each(function (idx, obj) {
            var i = $(obj);
            var button = i.parents('button');
            var card = button.parents('div.card');
            card.on('hide.bs.collapse', function(event) {
                button.prop('disabled', true);
                i.animateRotate(180, {
                    complete: function() {
                        button.prop('disabled', false);
                        i.css('transform', '')
                            .removeClass('fa-chevron-circle-up')
                            .addClass('fa-chevron-circle-down');
                    }
                });
            });
            card.on('show.bs.collapse', function(event) {
                button.prop('disabled', true);
                i.animateRotate(180, {
                    complete: function() {
                        button.prop('disabled', false);
                        i.css('transform', '')
                            .removeClass('fa-chevron-circle-down')
                            .addClass('fa-chevron-circle-up');
                    }
                });
            });
        });
    };

    self._setupWaitingModal = function() {
        self._modalWaiting = $('#waiting');

        self._modalWaiting.on('hidden.bs.modal', function (event) {
            // Reset the content
            var dialog = self._modalWaiting.find('div.modal-dialog');
            dialog.empty();
            $('<i class="fa fa-spinner fa-spin fa-5x"></i>').appendTo(dialog);
        });
    };


    self._setupLoadFromModal = function() {
        self._modalLoadFrom = $('#load_from');
        var load_from_list = self._modalLoadFrom.find('.dropbox-file-list');

        self._modalLoadFrom.on('show.bs.modal', function (event) {
            var event_fn = function(event2) {
                self._modalLoadFrom.modal('hide');
                self.toggleWaiting(true);
                self.load($(this).text().trim(), function(res) { self.toggleWaiting(false, res); });
            };
            self._populateFileList(load_from_list, event_fn);
        });
    };

    self._setupArrays = function() {
        $('[data-dd-array="append"]').click(function() { self._arrayAppend(this); });
        $('[data-dd-array="remove"]').click(function() { self._arrayRemove(this); });
        $('[data-dd-array="master"]').addClass('d-none');
    }

    self._arrayAppend = function(obj) {
        var container = $(obj).closest('[data-dd-array="container"]');
        var master = container.children('[data-dd-array="master"]');
        var items = container.children('[data-dd-array="item"]');
        // Clone the master, but copy the events too (add/remove buttons)
        var new_item = master.clone(true);
        new_item.removeClass('d-none')
            .attr('data-dd-array', 'item')
            .attr('data-dd-index', items.length.toString())
            .appendTo(container);
        self._setupDDPaths(new_item);
    }

    self._arrayRemove = function(obj) {
        var item = $(obj).closest('[data-dd-array="item"]');
        var container = item.closest('[data-dd-array="container"]')
        item.remove();
        self._arrayReindex(container);
    }

    self._arrayReindex = function(obj) {
        var container = $(obj).closest('[data-dd-array="container"]');
        var items = container.children('[data-dd-array="item"]');
        items.each(function (idx, item) {
            $(item).attr('data-dd-index', idx.toString());
        });
    }


    self.notify = function(cls, text) {
        var $div = $('<div class="alert alert-dismissible sticky-top fade show" role="alert">');
        $div.addClass('alert-' + cls);
        $div.text(text);
        $('<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
            '<span aria-hidden="true">&times;</span>' +
          '</button>').appendTo($div);
        $div.insertAfter('h1');
    };

    self.setup = function() {
        self._setupDDPaths();
        self._setupDropBox();
        self._setupSaveToModal();
        self._setupLoadFromModal();
        self._setupWaitingModal();
        self._setupAnimatedChevrons();
        self._setupArrays();
    };

    self.updateHier = function() {
        self._allControls().each(function (idx, obj) {
            self.data.set($(obj).data('dd-path'), $(obj).val());
        });
    };

    self.updateForm = function() {
        var flat_data = self.data.flatten();
        var ctrls = self._allControls();
        for (var path in flat_data) {
            ctrls.filter('[data-dd-path="' + path + '"]').val(flat_data[path]);
        }
    };

    self._populateFileList = function(obj, file_click_event) {
        obj = $(obj);
        obj.empty();
        $('<p class="text-center"><i class="fa fa-refresh fa-spin fa-3x"></i></p>').appendTo(obj);
        self.dropBox.filesListFolder({path: ''})
            .then(function(response) {
                obj.empty();
                var $ul = $('<ul class="list-unstyled ml-1"></ul>');
                for (var i = 0; i < response.entries.length; ++i) {
                var name = response.entries[i].name;
                $('<a href="#"></a>')
                    .text(' ' + name)
                    .prepend($('<i class="fa fa-file" aria-hidden="true"></i>'))
                    .click(file_click_event)
                    .appendTo($('<li></li>').appendTo($ul));
                }
                $ul.appendTo(obj);
            })
            .catch(function(error) {
                console.log(error);
                $('<p class="text-danger">Impossibile caricare la lista di file.</p>')
                    .appendTo(obj);
            });
    };

    self.toggleWaiting = function(on_off, success=null) {
        if (on_off) {
            self._modalWaiting.modal('show');
        } else if (success === null) {
            self._modalWaiting.modal('hide');
        } else {
            var dialog = self._modalWaiting.find('div.modal-dialog');
            dialog.empty();
            if (success) {
                $('<i class="fa fa-check fa-5x"></i>').appendTo(dialog);
            } else {
                $('<i class="fa fa-times fa-5x"></i>').appendTo(dialog);
            }
            setTimeout(function() {
                self._modalWaiting.modal('hide');
            }, 400);
        }
    }

    self.save = function(name, post_action=null) {
        self.updateHier();
        self.dropBox.filesUpload({
            path: '/' + name,
            mode: 'overwrite',
            contents: self.data.dump()
        })
            .then(function(response) {
                self.notify('success', 'Salvato su \'' + name +'\'.');
                if (post_action) {
                    post_action(true);
                }
            })
            .catch(function(error) {
                console.log(error);
                self.notify('danger', 'Impossibile salvare su DropBox.');
                if (post_action) {
                    post_action(false);
                }
            });
    };

    self.load = function(name, post_action=null) {
        self.dropBox.filesDownload({path: '/' + name})
            .then(function (response) {
                var blob = response.fileBlob;
                var reader = new FileReader();
                reader.addEventListener('loadend', function() {
                    self.data.load(reader.result);
                    self.updateForm();
                    if (post_action) {
                        post_action(true);
                    }
                });
                reader.readAsText(blob);
            })
            .catch(function (error) {
                self.notify('danger', 'Impossibile leggere da DropBox.');
                if (post_action) {
                    post_action(false);
                }
            });
    };

};


// https://stackoverflow.com/a/15191130/1749822
$.fn.animateRotate = function(angle, duration, easing, complete) {
  var args = $.speed(duration, easing, complete);
  var step = args.step;
  return this.each(function(i, e) {
    args.complete = $.proxy(args.complete, e);
    args.step = function(now) {
      $.style(e, 'transform', 'rotate(' + now + 'deg)');
      if (step) return step.apply(e, arguments);
    };

    $({deg: 0}).animate({deg: angle}, args);
  });
};
