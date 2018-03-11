from django.http import HttpResponse
from django.template import loader
from backend.event_kge import ekl_helper

# Create your views here.


def index(request):
    if request.method == 'POST':
        ekl_helper.init(request.POST)
        template = loader.get_template('ui/embedding.html')
    else:
        template = loader.get_template('ui/config.html')
    return HttpResponse(template.render(None, request))


def start_experiment(request):
    response = ekl_helper.start_experiment()
    return HttpResponse(response)


def embedding(request):
    if request.method == 'POST':
        iteration = int(request.POST.get('iteration'))
        response = ekl_helper.run_iteration(iteration)
        return HttpResponse(response)


def status(request):
    def eventStream():
        status = ekl_helper.get_status()
        yield "data:" + status + "\n\n"

    response = HttpResponse(eventStream(), content_type="text/event-stream")
    response['Cache-Control'] = 'no-cache'
    return response
